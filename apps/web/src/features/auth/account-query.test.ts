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

  it("keeps platform projections separate but reuses their verified identity in workspace", async () => {
    const queries = new QueryClient();
    await queries.query(accountQuery("native-a", true));
    expect(await verifiedWorkspaceAccount(queries, "native-a")).toMatchObject({
      id: "account-a",
    });
    expect(reader).toHaveBeenCalledTimes(1);
    expect(accountQueryKeys.projection("native-a", true)).not.toEqual(
      accountQueryKeys.projection("native-a", false),
    );
  });

  it("rejects a switched native subject rather than showing another actor's cache", async () => {
    const queries = new QueryClient();
    await queries.query(accountQuery("native-a"));
    native.getSession.mockResolvedValue(session("native-b"));
    await expect(verifiedWorkspaceAccount(queries, "native-a")).rejects.toThrow(
      "ACCOUNT_CHANGED",
    );
    await expect(queries.query(accountQuery("native-a", true))).rejects.toThrow(
      "ACCOUNT_CHANGED",
    );
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

  it("rejects an in-flight response after its native subject changes", async () => {
    const queries = new QueryClient();
    reader.mockImplementationOnce(async () => {
      native.getSession.mockResolvedValue(session("native-b"));
      return { id: "account-a", display_name: "Fixture" };
    });
    await expect(queries.query(accountQuery("native-a"))).rejects.toThrow("ACCOUNT_CHANGED");
    expect(queries.getQueryData(accountQueryKeys.projection("native-a"))).toBeUndefined();
  });
});
