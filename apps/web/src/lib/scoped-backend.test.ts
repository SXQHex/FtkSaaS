import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isCancelledError, QueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { delay, http, HttpResponse } from "msw";
import { server } from "../test/server";

const { native } = vi.hoisted(() => ({ native: { getSession: vi.fn() } }));
vi.mock("./supabase", () => ({ getSupabaseClient: () => ({ auth: native }) }));

import { BackendError } from "./backend";
import { scopedBackend, scopedCommandBackend, type AccountReadContext } from "./scoped-backend";
import {
  accountQuery,
  accountQueryKeys,
  invalidateAccountProjections,
} from "../features/auth/account-query";

const host = "http://127.0.0.1:54321";
const nativeId = "019a7b00-0000-7000-8000-000000000001";
const sessionId = "019a7b00-0000-7000-8000-000000000002";
const secondSessionId = "019a7b00-0000-7000-8000-000000000003";
const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000011",
  orgId: "019a7b00-0000-7000-8000-000000000012",
  centerId: "019a7b00-0000-7000-8000-000000000013",
};
const requestId = "019a7b00-0000-7000-8000-000000000014";

function session(identity = sessionId, subject = nativeId, suffix = "original"): Session {
  return {
    access_token: `fixture.${btoa(JSON.stringify({ sub: subject, session_id: identity }))}.${suffix}`,
    refresh_token: "synthetic-refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: subject,
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
      app_metadata: {},
      user_metadata: {},
    },
  };
}

const envelope = (data: unknown) => HttpResponse.json({ ok: true, data, trace_id: requestId });
const failure = (code: "FORBIDDEN" | "AUTH_REQUIRED" | "SESSION_REVOKED") =>
  HttpResponse.json({ ok: false, error: { code, retryable: false, trace_id: requestId } });
const page = { items: [], next_cursor: null, as_of: "2026-01-01T00:00:00Z" };
const request = { client_api_version: 1 as const, request_id: requestId };
const clients: QueryClient[] = [];
const calls: { operation: string; bearer: string | null }[] = [];
let current: Session | null;
let beforeAccount: () => Promise<void>;
let beforeFeature: () => Promise<void>;
let rejectedAccount: boolean;
let rejectedFeature: "FORBIDDEN" | "AUTH_REQUIRED" | "SESSION_REVOKED" | undefined;

const accountCount = () => calls.filter(({ operation }) => operation === "account_get_v1").length;
const featureCount = () => calls.filter(({ operation }) => operation === "people_list_v1").length;
function client() {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(queries);
  return queries;
}
async function readPage(context?: AccountReadContext) {
  const backend = await scopedBackend(scope, undefined, context);
  return backend.call("people_list_v1", { ...request, org_id: scope.orgId, page: { limit: 20 } });
}
function queryPage(queries: QueryClient, key: number) {
  return queries.query({ queryKey: ["people", scope.accountId, key], queryFn: readPage });
}

beforeEach(() => {
  calls.length = 0;
  current = session();
  beforeAccount = () => Promise.resolve();
  beforeFeature = () => Promise.resolve();
  rejectedAccount = false;
  rejectedFeature = undefined;
  native.getSession.mockReset().mockImplementation(async () => ({
    data: { session: current },
    error: null,
  }));
  vi.stubEnv("VITE_SUPABASE_URL", host);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "synthetic-public-key");
  server.use(
    http.post(
      `${host}/functions/v1/backend-v1/:operation`,
      async ({ request: incoming, params }) => {
        const operation = String(params.operation);
        calls.push({ operation, bearer: incoming.headers.get("authorization") });
        if (operation === "account_get_v1") {
          await beforeAccount();
          return rejectedAccount
            ? failure("AUTH_REQUIRED")
            : envelope({ id: scope.accountId, state: "active", display_name: "Synthetic account" });
        }
        if (operation === "people_list_v1") {
          await beforeFeature();
          return rejectedFeature ? failure(rejectedFeature) : envelope(page);
        }
        return envelope({});
      },
    ),
  );
});

afterEach(() => {
  for (const queries of clients.splice(0)) queries.clear();
  vi.unstubAllEnvs();
});

describe("Query-owned scoped account validation", () => {
  it("measures the unchanged strict path against shared cold and warm parallel reads", async () => {
    beforeAccount = () => delay(10);
    const queries = client();
    const initial = performance.now();
    await Promise.all(Array.from({ length: 5 }, () => readPage()));
    const strict = {
      account: accountCount(),
      feature: featureCount(),
      durationMs: performance.now() - initial,
    };
    calls.length = 0;
    const started = performance.now();
    await Promise.all(Array.from({ length: 5 }, (_, index) => queryPage(queries, index)));
    const cold = {
      account: accountCount(),
      feature: featureCount(),
      durationMs: performance.now() - started,
    };
    calls.length = 0;
    const warmed = performance.now();
    await Promise.all(Array.from({ length: 5 }, (_, index) => queryPage(queries, index + 5)));
    const warm = {
      account: accountCount(),
      feature: featureCount(),
      durationMs: performance.now() - warmed,
    };
    expect(strict.account).toBe(5);
    expect(strict.feature).toBe(5);
    expect(cold.account).toBe(1);
    expect(cold.feature).toBe(5);
    expect(warm.account).toBe(0);
    expect(warm.feature).toBe(5);
    console.info(
      "M08 synthetic scoped-read measurement",
      JSON.stringify({ fixtureAccountDelayMs: 10, strict, cold, warm }),
    );
  });

  it("reuses a platform projection without creating a second ordinary account projection", async () => {
    const queries = client();
    await queries.query(accountQuery(nativeId, true));
    await queryPage(queries, 1);
    expect(accountCount()).toBe(1);
    expect(featureCount()).toBe(1);
    expect(queries.getQueryData(accountQueryKeys.projection(nativeId))).toBeUndefined();
  });

  it("requires a new proof for the same user in a different native session before observer cleanup", async () => {
    const queries = client();
    await queries.query(accountQuery(nativeId));
    current = session(secondSessionId);
    await queryPage(queries, 1);
    expect(accountCount()).toBe(2);
    expect(calls.at(-1)?.bearer).toBe(`Bearer ${current.access_token}`);
  });

  it("keeps a proven projection across a normal bearer refresh of the same session", async () => {
    const queries = client();
    await queries.query(accountQuery(nativeId));
    current = session(sessionId, nativeId, "refreshed");
    await queryPage(queries, 1);
    expect(accountCount()).toBe(1);
    expect(calls.at(-1)?.bearer).toBe(`Bearer ${current.access_token}`);
    const cache = JSON.stringify(
      queries
        .getQueryCache()
        .getAll()
        .map((query) => ({ key: query.queryKey, data: query.state.data, meta: query.meta })),
    );
    expect(cache).not.toContain(current.access_token);
    expect(cache).not.toContain("synthetic-refresh");
  });

  it("does not trust manually seeded account DTOs even when their timestamps are fresh", async () => {
    const queries = client();
    queries.setQueryData(accountQueryKeys.projection(nativeId), { id: scope.accountId });
    await queryPage(queries, 1);
    expect(accountCount()).toBe(1);
    expect(featureCount()).toBe(1);
  });

  it("refreshes invalidated and expired projections through the same Query", async () => {
    const queries = client();
    await queries.query(accountQuery(nativeId));
    await invalidateAccountProjections(queries);
    await queryPage(queries, 1);
    expect(accountCount()).toBe(2);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 30_001);
    await queryPage(queries, 2);
    expect(accountCount()).toBe(3);
  });

  it("does not renew proof age by reseeding a previously verified account DTO", async () => {
    const queries = client();
    const account = await queries.query(accountQuery(nativeId));
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 30_001);
    queries.setQueryData(accountQueryKeys.projection(nativeId), account);
    await queryPage(queries, 1);
    expect(accountCount()).toBe(2);
  });

  it("does not turn an ordinary account proof into a privileged projection", async () => {
    const queries = client();
    const account = await queries.query(accountQuery(nativeId));
    queries.removeQueries({ queryKey: accountQueryKeys.projection(nativeId), exact: true });
    queries.setQueryData(accountQueryKeys.projection(nativeId, true), account);
    await queryPage(queries, 1);
    expect(accountCount()).toBe(2);
  });

  it("refreshes a failed projection instead of accepting the old successful data", async () => {
    const queries = client();
    await queries.query(accountQuery(nativeId));
    rejectedAccount = true;
    await expect(queries.query({ ...accountQuery(nativeId), staleTime: 0 })).rejects.toThrow(
      "AUTH_REQUIRED",
    );
    rejectedAccount = false;
    await queryPage(queries, 1);
    expect(accountCount()).toBe(3);
  });

  it("blocks a stale editor account and signed-out reader before a feature request", async () => {
    const queries = client();
    await queries.query(accountQuery(nativeId));
    const context = { client: queries, signal: new AbortController().signal };
    await expect(scopedBackend({ accountId: scope.orgId }, undefined, context)).rejects.toThrow(
      "ACCOUNT_CHANGED",
    );
    current = null;
    await expect(readPage(context)).rejects.toThrow("AUTH_REQUIRED");
    expect(accountCount()).toBe(1);
    expect(featureCount()).toBe(0);
  });

  it("rejects actor and same-user session changes while a feature response is pending", async () => {
    for (const replacement of [session(secondSessionId), session(secondSessionId, scope.orgId)]) {
      current = session();
      const queries = client();
      beforeFeature = async () => {
        current = replacement;
      };
      await expect(queryPage(queries, 1)).rejects.toThrow("ACCOUNT_CHANGED");
      expect(queries.getQueryData(["people", scope.accountId, 1])).toBeUndefined();
    }
  });

  it("cancels one Query consumer without cancelling the shared account request for another", async () => {
    const queries = client();
    const gate = Promise.withResolvers<void>();
    beforeAccount = () => gate.promise;
    const first = queryPage(queries, 1).catch((error: unknown) => error);
    const second = queryPage(queries, 2);
    await vi.waitFor(() => expect(accountCount()).toBe(1));
    await queries.cancelQueries({ queryKey: ["people", scope.accountId, 1], exact: true });
    gate.resolve();
    expect(isCancelledError(await first)).toBe(true);
    expect(await second).toEqual(page);
    expect(accountCount()).toBe(1);
    expect(featureCount()).toBe(1);
  });

  it("rejects an old account denial after a native session handoff", async () => {
    const queries = client();
    beforeAccount = async () => {
      current = session(secondSessionId);
    };
    rejectedAccount = true;
    await expect(queryPage(queries, 1)).rejects.toThrow("ACCOUNT_CHANGED");
    expect(featureCount()).toBe(0);
    expect(queries.getQueryData(accountQueryKeys.projection(nativeId))).toBeUndefined();
  });

  it("rejects late call and read denials from a previous session before access recovery", async () => {
    for (const method of ["call", "read"] as const) {
      current = session();
      const queries = client();
      beforeFeature = async () => {
        current = session(secondSessionId);
      };
      rejectedFeature = "SESSION_REVOKED";
      await expect(
        queries.query({
          queryKey: ["late-denial", method],
          queryFn: async (context) => {
            const backend = await scopedBackend(scope, undefined, context);
            const body = { ...request, org_id: scope.orgId, page: { limit: 20 } };
            return method === "call"
              ? backend.call("people_list_v1", body)
              : backend.read("people_list_v1", body, context.signal);
          },
        }),
      ).rejects.toThrow("ACCOUNT_CHANGED");
      expect(queries.getQueryData(["late-denial", method])).toBeUndefined();
    }
  });

  it("does not forward an old denial after its reader was cancelled", async () => {
    const queries = client();
    const controller = new AbortController();
    beforeFeature = async () => {
      controller.abort(new Error("QUERY_REPLACED"));
    };
    rejectedFeature = "SESSION_REVOKED";
    await expect(readPage({ client: queries, signal: controller.signal })).rejects.toThrow(
      "QUERY_REPLACED",
    );
  });

  it("aborts the actual transport for a Query-owned call without retrying the request", async () => {
    const queries = client();
    let onRequest!: (signal: AbortSignal) => void;
    const requestStarted = new Promise<AbortSignal>((resolve) => {
      onRequest = resolve;
    });
    server.use(
      http.post(`${host}/functions/v1/backend-v1/people_list_v1`, async ({ request: incoming }) => {
        onRequest(incoming.signal);
        await new Promise<void>((resolve) => {
          incoming.signal.addEventListener("abort", () => resolve(), { once: true });
        });
        return envelope(page);
      }),
    );
    const key = ["people", scope.accountId, 10];
    const pending = queryPage(queries, 10).catch((error: unknown) => error);
    const transport = await requestStarted;
    expect(transport.aborted).toBe(false);
    await queries.cancelQueries({ queryKey: key, exact: true });
    expect(isCancelledError(await pending)).toBe(true);
    expect(transport.aborted).toBe(true);
    expect(queries.getQueryData(key)).toBeUndefined();
  });

  it("aborts a shared account projection in flight without caching a late response", async () => {
    const queries = client();
    const requestStarted = Promise.withResolvers<AbortSignal>();
    server.use(
      http.post(`${host}/functions/v1/backend-v1/account_get_v1`, async ({ request: incoming }) => {
        requestStarted.resolve(incoming.signal);
        await new Promise<void>((resolve) =>
          incoming.signal.addEventListener("abort", () => resolve(), { once: true }),
        );
        return envelope({ id: scope.accountId });
      }),
    );
    const source = accountQuery(nativeId);
    const pending = queries.fetchQuery(source).catch((failure: unknown) => failure);
    const transport = await requestStarted.promise;
    await queries.cancelQueries({ queryKey: source.queryKey, exact: true });
    expect(isCancelledError(await pending)).toBe(true);
    expect(transport.aborted).toBe(true);
    expect(queries.getQueryData(source.queryKey)).toBeUndefined();
  });

  it.each(["call", "read"] as const)(
    "uses a fresh account and aborts a standalone editor %s on close",
    async (method) => {
      const requestStarted = Promise.withResolvers<AbortSignal>();
      server.use(
        http.post(
          `${host}/functions/v1/backend-v1/people_list_v1`,
          async ({ request: incoming }) => {
            requestStarted.resolve(incoming.signal);
            await new Promise<void>((resolve) =>
              incoming.signal.addEventListener("abort", () => resolve(), { once: true }),
            );
            return envelope(page);
          },
        ),
      );
      const controller = new AbortController();
      const backend = await scopedBackend(scope, controller.signal);
      const body = {
        ...request,
        org_id: scope.orgId,
        center_id: scope.centerId,
        page: { limit: 20 },
      };
      const result =
        method === "read"
          ? backend.read("people_list_v1", body, new AbortController().signal)
          : backend.call("people_list_v1", body);
      const pending = result.catch((failure: unknown) => failure);
      const transport = await requestStarted.promise;
      controller.abort(new Error("EDITOR_CLOSED"));
      expect(await pending).toMatchObject({ message: "EDITOR_CLOSED" });
      expect(transport.aborted).toBe(true);
      expect(accountCount()).toBe(1);
    },
  );

  it("retains independent fresh checks for native write, receipt and mandatory readback", async () => {
    const queries = client();
    await queries.query(accountQuery(nativeId));
    calls.length = 0;
    await (
      await scopedBackend(scope)
    ).call("studio_setup_open_v1", {
      ...request,
      operation_key: requestId,
      name: "Synthetic studio",
    });
    await (
      await scopedBackend(scope)
    ).call("operation_status_get_v1", {
      ...request,
      operation: "studio_setup_open_v1",
      key: requestId,
    });
    await readPage();
    expect(accountCount()).toBe(3);
    expect(calls.map(({ operation }) => operation)).toEqual([
      "account_get_v1",
      "studio_setup_open_v1",
      "account_get_v1",
      "operation_status_get_v1",
      "account_get_v1",
      "people_list_v1",
    ]);
  });

  it("preserves native access errors despite a fresh matching account projection", async () => {
    const queries = client();
    await queries.query(accountQuery(nativeId));
    for (const [index, code] of (
      ["FORBIDDEN", "AUTH_REQUIRED", "SESSION_REVOKED"] as const
    ).entries()) {
      rejectedFeature = code;
      await expect(queryPage(queries, index)).rejects.toMatchObject({ code, retryable: false });
      expect(queries.getQueryState(["people", scope.accountId, index])?.error).toBeInstanceOf(
        BackendError,
      );
      expect(queries.getQueryData(["people", scope.accountId, index])).toBeUndefined();
    }
    expect(accountCount()).toBe(1);
  });
});

describe("a preflight-bound native command", () => {
  const invoke = (backend: Awaited<ReturnType<typeof scopedBackend>>) =>
    backend.call("people_list_v1", { ...request, org_id: scope.orgId, page: { limit: 20 } });

  it("reuses the verified bearer for the first dispatch and verifies the account on retry", async () => {
    const command = await scopedCommandBackend(scope);
    await invoke(command.backend);
    await command.write(invoke);
    expect(accountCount()).toBe(1);
    expect(featureCount()).toBe(2);

    await command.write(invoke);
    expect(accountCount()).toBe(2);
    expect(featureCount()).toBe(3);
  });

  it("verifies the account again when a normal refresh changes the bearer", async () => {
    const command = await scopedCommandBackend(scope);
    current = session(sessionId, nativeId, "refreshed");
    await command.write(invoke);
    expect(accountCount()).toBe(2);
    expect(calls.at(-1)).toEqual({
      operation: "people_list_v1",
      bearer: "Bearer " + current.access_token,
    });
  });

  it("rejects a new session for the same user before dispatch", async () => {
    const command = await scopedCommandBackend(scope);
    current = session(secondSessionId);
    await expect(command.write(invoke)).rejects.toThrow("ACCOUNT_CHANGED");
    expect(accountCount()).toBe(1);
    expect(featureCount()).toBe(0);
  });

  it("keeps a received acknowledgment while rejecting readback from a replacement session", async () => {
    const command = await scopedCommandBackend(scope);
    beforeFeature = async () => {
      current = session(secondSessionId);
    };
    await expect(command.write(invoke)).resolves.toEqual(page);
    await expect(command.readback(invoke)).rejects.toThrow("ACCOUNT_CHANGED");
    expect(featureCount()).toBe(1);
    await expect(command.write(invoke)).rejects.toThrow("ACCOUNT_CHANGED");
    expect(featureCount()).toBe(1);
  });

  it("revalidates the account for readback and discards a late denial from a replaced session", async () => {
    const command = await scopedCommandBackend(scope);
    beforeFeature = async () => {
      rejectedFeature = "FORBIDDEN";
      current = session(secondSessionId);
    };
    await expect(command.readback(invoke)).rejects.toThrow("ACCOUNT_CHANGED");
    expect(accountCount()).toBe(2);
    expect(featureCount()).toBe(1);
  });
});
