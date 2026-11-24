import { QueryClient } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { BackendError } from "../../lib/backend";
import { observeQueryAccessFailures } from "../auth/query-access-recovery";
import { resolveCalendarSession } from "./calendar-session";

const { getSession, call } = vi.hoisted(() => ({ getSession: vi.fn(), call: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: { getSession } }) }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
vi.mock("../auth/account-query", () => ({
  verifiedWorkspaceAccount: async () => ({ id: "domain-account" }),
}));
vi.mock("../workspace/workspace-query", () => ({
  refreshWorkspace: async () => ({ centers: [] }),
}));

const userId = "019a7b00-0000-7000-8000-000000000001";
const orgId = "019a7b00-0000-7000-8000-000000000002";
const sessionId = "019a7b00-0000-7000-8000-000000000003";
const cachedKey = ["member-reservations", "domain-account", orgId];

function nativeSession(nativeSessionId: string) {
  const payload = btoa(JSON.stringify({ sub: userId, session_id: nativeSessionId }));
  return {
    data: { session: { access_token: `fixture.${payload}.signed`, user: { id: userId } } },
    error: null,
  };
}

const revoked = new BackendError({
  code: "SESSION_REVOKED",
  retryable: false,
  trace_id: sessionId,
});
beforeEach(() => {
  getSession.mockReset().mockResolvedValue(nativeSession(sessionId));
  call.mockReset();
});

it("evicts warm private data when the pinned calendar lookup reports session revocation", async () => {
  const queries = new QueryClient();
  const showLogin = vi.fn(async () => {});
  const unsubscribe = observeQueryAccessFailures(queries, {
    showLogin,
    invalidateRoute: async () => {},
    onChecking: () => {},
  });
  queries.setQueryData(cachedKey, ["previous private result"]);
  call.mockRejectedValueOnce(revoked);
  await expect(
    resolveCalendarSession(queries, userId, orgId, sessionId, new AbortController().signal),
  ).resolves.toEqual({ kind: "signedOut" });
  expect(queries.getQueryData(cachedKey)).toBeUndefined();
  expect(showLogin).not.toHaveBeenCalled();
  unsubscribe();
});

it("does not clear a replacement session's cache on a delayed denial from the old bearer", async () => {
  const queries = new QueryClient();
  call.mockImplementationOnce(() => {
    getSession.mockResolvedValue(nativeSession(userId));
    queries.setQueryData(cachedKey, ["replacement private result"]);
    throw revoked;
  });
  await expect(
    resolveCalendarSession(queries, userId, orgId, sessionId, new AbortController().signal),
  ).rejects.toThrow("ACCOUNT_CHANGED");
  expect(queries.getQueryData(cachedKey)).toEqual(["replacement private result"]);
});

it("shares the in-flight center lookup when authentication reloads the route", async () => {
  const queries = new QueryClient();
  const fetch = vi.spyOn(queries, "query");
  const read = Promise.withResolvers<{ id: string; center_id: string }>();
  call.mockReturnValue(read.promise);
  const previous = new AbortController();
  const first = resolveCalendarSession(queries, userId, orgId, sessionId, previous.signal);
  const canceled = expect(first).rejects.toHaveProperty("name", "AbortError");
  await vi.waitFor(() => expect(call).toHaveBeenCalledOnce());
  previous.abort();
  const second = resolveCalendarSession(
    queries,
    userId,
    orgId,
    sessionId,
    new AbortController().signal,
  );
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  read.resolve({ id: sessionId, center_id: orgId });
  await canceled;
  await expect(second).resolves.toEqual({ kind: "unavailable" });
  expect(call).toHaveBeenCalledOnce();
});
