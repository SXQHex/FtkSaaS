import { beforeEach, describe, expect, it, vi } from "vitest";
import { CancelledError, QueryClient } from "@tanstack/react-query";
import { BackendError } from "../../lib/backend";

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
  verifiedAccountProjection,
  verifiedWorkspaceAccount,
} from "./account-query";

const session = (userId = "native-a") => ({
  data: { session: { user: { id: userId }, access_token: "native-fixture" } },
  error: null,
});

function observe<T>(promise: Promise<T>) {
  let settled = false;
  const result = promise.then(
    (value) => {
      settled = true;
      return { status: "fulfilled" as const, value };
    },
    (error: unknown) => {
      settled = true;
      return { status: "rejected" as const, error };
    },
  );
  return {
    result,
    get settled() {
      return settled;
    },
  };
}

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

  it("keeps a cold route waiting for the replacement account read when command refresh invalidates it", async () => {
    const queries = new QueryClient();
    const original = Promise.withResolvers<{ id: string; display_name: string }>();
    const replacement = Promise.withResolvers<{ id: string; display_name: string }>();
    const current = { id: "account-a", display_name: "Current session readback" };
    reader
      .mockImplementationOnce(() => original.promise)
      .mockImplementation(() => replacement.promise);
    const route = observe(verifiedAccountProjection(queries, "native-a", true));
    try {
      await vi.waitFor(() => expect(reader).toHaveBeenCalledTimes(1));
      const invalidation = observe(invalidateAccountProjections(queries));
      const refresh = observe(verifiedAccountForId(queries, "account-a", true));
      await vi.waitFor(() => expect(reader).toHaveBeenCalledTimes(2));
      const pending = { route: !route.settled, refresh: !refresh.settled };

      replacement.resolve(current);
      const [routeResult, refreshResult, invalidationResult] = await Promise.all([
        route.result,
        refresh.result,
        invalidation.result,
      ]);
      original.resolve({ id: "account-a", display_name: "Late cancelled route response" });
      await original.promise;
      await Promise.resolve();

      expect(pending).toEqual({ route: true, refresh: true });
      expect(routeResult).toEqual({ status: "fulfilled", value: current });
      expect(refreshResult).toEqual({ status: "fulfilled", value: current });
      expect(invalidationResult).toEqual({ status: "fulfilled", value: undefined });
      expect(queries.getQueryData(accountQueryKeys.projection("native-a", true))).toEqual(current);
      expect(reader).toHaveBeenCalledTimes(2);
      expect(queries.getQueryData(accountQueryKeys.projection("native-a"))).toBeUndefined();
    } finally {
      original.resolve({ id: "account-a", display_name: "Late cancelled route response" });
      replacement.resolve(current);
      queries.clear();
    }
  });

  it("does not return a reverted warm account while a second invalidation replaces its pending refresh", async () => {
    const queries = new QueryClient();
    const original = Promise.withResolvers<{ id: string; display_name: string }>();
    const replacement = Promise.withResolvers<{ id: string; display_name: string }>();
    const current = { id: "account-a", display_name: "Current mutation readback" };
    const previous = await queries.query(accountQuery("native-a", true));
    expect(previous.display_name).toBe("Fixture");
    await invalidateAccountProjections(queries);
    expect(reader).toHaveBeenCalledTimes(1);
    reader
      .mockImplementationOnce(() => original.promise)
      .mockImplementation(() => replacement.promise);
    const route = observe(verifiedAccountProjection(queries, "native-a", true));
    try {
      await vi.waitFor(() => expect(reader).toHaveBeenCalledTimes(2));
      const invalidation = observe(invalidateAccountProjections(queries));
      const refresh = observe(verifiedAccountForId(queries, "account-a", true));
      await vi.waitFor(() => expect(reader).toHaveBeenCalledTimes(3));
      const pending = { route: !route.settled, refresh: !refresh.settled };

      replacement.resolve(current);
      const [routeResult, refreshResult, invalidationResult] = await Promise.all([
        route.result,
        refresh.result,
        invalidation.result,
      ]);
      original.resolve({ id: "account-a", display_name: "Late superseded mutation response" });
      await original.promise;
      await Promise.resolve();

      expect(pending).toEqual({ route: true, refresh: true });
      expect(routeResult).toEqual({ status: "fulfilled", value: current });
      expect(refreshResult).toEqual({ status: "fulfilled", value: current });
      expect(invalidationResult).toEqual({ status: "fulfilled", value: undefined });
      expect(queries.getQueryData(accountQueryKeys.projection("native-a", true))).toEqual(current);
      expect(queries.getQueryData(accountQueryKeys.projection("native-a", true))).not.toBe(
        previous,
      );
      expect(reader).toHaveBeenCalledTimes(3);
    } finally {
      original.resolve({ id: "account-a", display_name: "Late superseded mutation response" });
      replacement.resolve(current);
      queries.clear();
    }
  });

  it("propagates the replacement account denial to both route and refresh waiters", async () => {
    const queries = new QueryClient();
    const original = Promise.withResolvers<{ id: string; display_name: string }>();
    const replacement = Promise.withResolvers<{ id: string; display_name: string }>();
    const denial = new BackendError({
      code: "AUTH_REQUIRED",
      retryable: false,
      trace_id: "019a7b00-0000-7000-8000-000000000103",
    });
    reader
      .mockImplementationOnce(() => original.promise)
      .mockImplementation(() => replacement.promise);
    const route = observe(verifiedAccountProjection(queries, "native-a", true));
    try {
      await vi.waitFor(() => expect(reader).toHaveBeenCalledTimes(1));
      const invalidation = observe(invalidateAccountProjections(queries));
      const refresh = observe(verifiedAccountForId(queries, "account-a", true));
      await vi.waitFor(() => expect(reader).toHaveBeenCalledTimes(2));
      replacement.reject(denial);
      const [routeResult, refreshResult] = await Promise.all([
        route.result,
        refresh.result,
        invalidation.result,
      ]);
      original.resolve({ id: "account-a", display_name: "Late denied-session response" });
      await original.promise;
      await Promise.resolve();

      expect(routeResult).toEqual({ status: "rejected", error: denial });
      expect(refreshResult).toEqual({ status: "rejected", error: denial });
      expect(queries.getQueryData(accountQueryKeys.projection("native-a", true))).toBeUndefined();
      expect(queries.getQueryState(accountQueryKeys.projection("native-a", true))?.error).toBe(
        denial,
      );
      expect(reader).toHaveBeenCalledTimes(2);
    } finally {
      original.resolve({ id: "account-a", display_name: "Late denied-session response" });
      replacement.resolve({ id: "account-a", display_name: "Unused denial cleanup" });
      queries.clear();
    }
  });

  it.each(["remove", "clear"] as const)(
    "does not resurrect an in-flight account query removed by %s during invalidation",
    async (action) => {
      const queries = new QueryClient();
      const original = Promise.withResolvers<{ id: string; display_name: string }>();
      const key = accountQueryKeys.projection("native-a", true);
      reader.mockImplementation(() => original.promise);
      const route = observe(verifiedAccountProjection(queries, "native-a", true));
      let unsubscribe: (() => void) | undefined;
      try {
        await vi.waitFor(() => expect(reader).toHaveBeenCalledTimes(1));
        const pendingQuery = queries.getQueryCache().find({ queryKey: key, exact: true });
        expect(pendingQuery).toBeDefined();
        unsubscribe = queries.getQueryCache().subscribe((event) => {
          if (
            event.type === "updated" &&
            event.query === pendingQuery &&
            event.query.state.fetchStatus === "idle"
          ) {
            if (action === "clear") queries.clear();
            else queries.removeQueries({ queryKey: key, exact: true });
          }
        });
        const invalidation = observe(invalidateAccountProjections(queries));
        original.resolve({ id: "account-a", display_name: "Removed session response" });
        const [routeResult, invalidationResult] = await Promise.all([
          route.result,
          invalidation.result,
        ]);

        expect(routeResult).toEqual({ status: "rejected", error: expect.any(CancelledError) });
        expect(invalidationResult).toEqual({ status: "fulfilled", value: undefined });
        expect(reader).toHaveBeenCalledTimes(1);
        expect(queries.getQueryCache().find({ queryKey: key, exact: true })).toBeUndefined();
      } finally {
        unsubscribe?.();
        original.resolve({ id: "account-a", display_name: "Removed session response" });
        queries.clear();
      }
    },
  );

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
