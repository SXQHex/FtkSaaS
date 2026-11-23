import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const { native, reader } = vi.hoisted(() => ({
  native: { getSession: vi.fn() },
  reader: vi.fn(),
}));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: native }) }));
vi.mock("../../lib/account", () => ({ readAccount: reader }));

import {
  accountQuery,
  accountQueryKeys,
  invalidateAccountProjections,
  verifiedAccountForId,
  verifiedWorkspaceAccount,
} from "./account-query";

const session = (userId = "native-a") => ({
  data: { session: { user: { id: userId }, access_token: "native-fixture" } },
  error: null,
});

beforeEach(() => {
  native.getSession.mockReset().mockResolvedValue(session());
  reader.mockReset().mockResolvedValue({ id: "account-a", display_name: "Fixture" });
});

describe("shared account projections", () => {
  it("deduplicates route reads without equating native and backend account IDs", async () => {
    const queries = new QueryClient();
    const a = await queries.query(accountQuery("native-a"));
    const b = await queries.query(accountQuery("native-a"));
    expect(a).toBe(b);
    expect(a.id).toBe("account-a");
    expect(reader).toHaveBeenCalledTimes(1);
    expect(reader).toHaveBeenCalledWith(false, "native-fixture");
    expect(queries.getQueryData(accountQueryKeys.projection("native-a"))).toBe(a);
  });

  it("keeps privileged account projection separate and reusable in workspace", async () => {
    const queries = new QueryClient();
    await queries.query(accountQuery("native-a", true));
    expect(await verifiedWorkspaceAccount(queries, "native-a")).toMatchObject({ id: "account-a" });
    expect(reader).toHaveBeenCalledTimes(1);
    expect(accountQueryKeys.projection("native-a", true)).not.toEqual(
      accountQueryKeys.projection("native-a", false),
    );
  });

  it("rejects a switched native subject rather than showing another actor's cache", async () => {
    const queries = new QueryClient();
    await queries.query(accountQuery("native-a"));
    native.getSession.mockResolvedValue(session("native-b"));
    await expect(verifiedWorkspaceAccount(queries, "native-a")).rejects.toThrow("ACCOUNT_CHANGED");
    await expect(queries.query(accountQuery("native-a", true))).rejects.toThrow("ACCOUNT_CHANGED");
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("invalidates both projections after a mutation", async () => {
    const queries = new QueryClient();
    await queries.query(accountQuery("native-a"));
    await queries.query(accountQuery("native-a", true));
    expect(reader).toHaveBeenCalledTimes(2);
    await invalidateAccountProjections(queries);
    await queries.query(accountQuery("native-a"));
    await queries.query(accountQuery("native-a", true));
    expect(reader).toHaveBeenCalledTimes(4);
  });

  it("refreshes the privileged projection without an extra ordinary read", async () => {
    const queries = new QueryClient();
    await queries.query(accountQuery("native-a", true));
    await invalidateAccountProjections(queries);
    expect(await verifiedAccountForId(queries, "account-a")).toMatchObject({ id: "account-a" });
    expect(reader).toHaveBeenCalledTimes(2);
    expect(reader).toHaveBeenNthCalledWith(2, true, "native-fixture");
    expect(queries.getQueryData(accountQueryKeys.projection("native-a"))).toBeUndefined();
  });

  it("refreshes only the privileged projection after mutation", async () => {
    const queries = new QueryClient();
    await queries.query(accountQuery("native-a"));
    await queries.query(accountQuery("native-a", true));
    await invalidateAccountProjections(queries);
    await verifiedAccountForId(queries, "account-a", true);
    expect(reader).toHaveBeenCalledTimes(3);
    expect(reader).toHaveBeenNthCalledWith(3, true, "native-fixture");
  });

  it("checks the backend account identity even when an actor projection is cached", async () => {
    const queries = new QueryClient();
    await queries.query(accountQuery("native-a"));
    await expect(verifiedAccountForId(queries, "another-account")).rejects.toThrow(
      "ACCOUNT_CHANGED",
    );
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("blocks a missing session before reading any account projection", async () => {
    const queries = new QueryClient();
    native.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(verifiedAccountForId(queries, "account-a")).rejects.toThrow("AUTH_REQUIRED");
    expect(reader).not.toHaveBeenCalled();
  });

  it("rejects an in-flight response after its native subject changes", async () => {
    const queries = new QueryClient();
    reader.mockImplementationOnce(async () => {
      native.getSession.mockResolvedValue(session("native-b"));
      return { id: "account-a", display_name: "Fixture" };
    });
    await expect(queries.query(accountQuery("native-a"))).rejects.toThrow("ACCOUNT_CHANGED");
    expect(queries.getQueryData(accountQueryKeys.projection("native-a"))).toBeUndefined();
  });

  it("rejects a late account read from the previous native session of the same actor", async () => {
    const encoded = (sessionId: string) =>
      btoa(JSON.stringify({ sub: "native-a", session_id: sessionId }))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/, "");
    const oldSession = {
      data: {
        session: {
          user: { id: "native-a" },
          access_token: `fixture.${encoded("019a7b00-0000-7000-8000-000000000101")}.old`,
        },
      },
      error: null,
    };
    const newSession = {
      data: {
        session: {
          user: { id: "native-a" },
          access_token: `fixture.${encoded("019a7b00-0000-7000-8000-000000000102")}.new`,
        },
      },
      error: null,
    };
    const queries = new QueryClient();
    native.getSession.mockResolvedValueOnce(oldSession).mockResolvedValue(newSession);
    await expect(queries.query(accountQuery("native-a"))).rejects.toThrow("ACCOUNT_CHANGED");
    expect(reader).toHaveBeenCalledWith(false, oldSession.data.session.access_token);
    expect(queries.getQueryData(accountQueryKeys.projection("native-a"))).toBeUndefined();
  });

  it("accepts a refreshed bearer when the native session_id is unchanged", async () => {
    const encoded = btoa(
      JSON.stringify({
        sub: "native-a",
        session_id: "019a7b00-0000-7000-8000-000000000103",
      }),
    )
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
    const original = {
      data: {
        session: { user: { id: "native-a" }, access_token: `fixture.${encoded}.old` },
      },
      error: null,
    };
    const refreshed = {
      data: {
        session: { user: { id: "native-a" }, access_token: `fixture.${encoded}.new` },
      },
      error: null,
    };
    native.getSession.mockResolvedValueOnce(original).mockResolvedValue(refreshed);
    const queries = new QueryClient();
    expect(await queries.query(accountQuery("native-a"))).toMatchObject({ id: "account-a" });
    expect(reader).toHaveBeenCalledExactlyOnceWith(false, original.data.session.access_token);
  });

  it("rejects a late same-actor read when an opaque bearer rotates", async () => {
    const queries = new QueryClient();
    native.getSession.mockResolvedValueOnce(session("native-a")).mockResolvedValue({
      data: {
        session: { user: { id: "native-a" }, access_token: "opaque-replaced" },
      },
      error: null,
    });
    await expect(queries.query(accountQuery("native-a"))).rejects.toThrow("ACCOUNT_CHANGED");
    expect(queries.getQueryData(accountQueryKeys.projection("native-a"))).toBeUndefined();
  });
});
