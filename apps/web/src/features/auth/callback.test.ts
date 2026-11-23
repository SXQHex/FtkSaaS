import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
const { auth, account } = vi.hoisted(() => ({
  auth: {
    exchangeCodeForSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    getSession: vi.fn(),
    getClaims: vi.fn(),
    mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
  },
  account: vi.fn(),
}));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth }) }));
vi.mock("../../lib/account", () => ({ readAccount: account }));
import { completeCallback, safeNext } from "./callback";
import { accountQueryKeys } from "./account-query";
import { loadPlatformAccount } from "./account-guard";
import { BackendError } from "../../lib/backend";

const nativeUserId = "019a7b00-0000-7000-8000-000000000001";
const firstSessionId = "019a7b00-0000-7000-8000-000000000101";
function nativeSession(
  userId = nativeUserId,
  sessionId = firstSessionId,
  suffix = "original",
): Session {
  const claims = btoa(JSON.stringify({ sub: userId, session_id: sessionId }));
  return {
    access_token: `fixture.${claims}.${suffix}`,
    refresh_token: "fixture-refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-11-23T00:00:00Z",
    },
  };
}
beforeEach(() => {
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  auth.getSession.mockResolvedValue({ data: { session: nativeSession() }, error: null });
  account.mockResolvedValue({ id: "domain-account", display_name: "Fixture" });
});
afterEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
});
it.each(["https://evil.invalid", "//evil.invalid", "/account?redirect=evil", "/unknown"])(
  "rejects external or unlisted next %s",
  (next) => expect(safeNext(next)).toBe("/account"),
);
it("exchanges a code once even if the route is requested twice", async () => {
  auth.exchangeCodeForSession.mockResolvedValue({
    data: { session: nativeSession(), redirectType: null },
    error: null,
  });
  auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
  await Promise.all([
    completeCallback({ code: "callback-code-one", next: "/account" }),
    completeCallback({ code: "callback-code-one", next: "/account" }),
  ]);
  expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith(
    "callback-code-one",
    undefined,
  );
  expect(account).toHaveBeenCalledOnce();
});
it("does not accept provider errors or a missing code as a signed-in result", async () => {
  await expect(
    completeCallback({ code: "never-exchange", providerError: true, next: "/account" }),
  ).rejects.toThrow();
  await expect(completeCallback({ next: "/account" })).rejects.toThrow();
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
});
it("keeps account reads closed when native AAL2 is still required", async () => {
  auth.exchangeCodeForSession.mockResolvedValue({
    data: { session: nativeSession(), redirectType: null },
    error: null,
  });
  auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal2" },
    error: null,
  });
  expect(await completeCallback({ code: "callback-code-mfa", next: "/account" })).toBe("/mfa");
  expect(account).not.toHaveBeenCalled();
});

it("captures the native redirect before Router setup and removes URL credentials", async () => {
  const { captureAuthCallback, capturedCallback } = await import("./callback");
  window.history.replaceState(
    {},
    "",
    "/auth/callback?code=bootstrap-code&next=//outside.invalid#access_token=fixture-token",
  );
  captureAuthCallback();
  expect(window.location.pathname).toBe("/auth/callback");
  expect(window.location.search).toBe("");
  expect(window.location.hash).toBe("");
  expect(capturedCallback()).toEqual({
    code: "bootstrap-code",
    flowId: undefined,
    providerError: false,
    next: "/account",
  });
  window.history.replaceState({}, "", "/");
});

it("recognizes native recovery even before the root session observer mounts", async () => {
  auth.getClaims.mockResolvedValue({
    data: { claims: { sub: "native-recovery-user", session_id: "native-session-one" } },
    error: null,
  });
  auth.getSession.mockResolvedValue({
    data: { session: nativeSession("native-recovery-user") },
    error: null,
  });
  auth.exchangeCodeForSession.mockImplementation(async () => {
    auth.onAuthStateChange.mock.calls[0][0](
      "PASSWORD_RECOVERY",
      nativeSession("native-recovery-user"),
    );
    return { data: { session: nativeSession("native-recovery-user") }, error: null };
  });
  auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
  expect(await completeCallback({ code: "native-recovery-code", next: "/reset-password" })).toBe(
    "/reset-password",
  );
  expect(sessionStorage.getItem("ftk-recovery-account")).toBe(
    "native-recovery-user:native-session-one",
  );
  expect(account).toHaveBeenCalledExactlyOnceWith(
    false,
    nativeSession("native-recovery-user").access_token,
    expect.any(AbortSignal),
  );
});
it("does not turn a normal OAuth session into a recovery session by changing next", async () => {
  auth.exchangeCodeForSession.mockResolvedValue({
    data: { session: nativeSession("normal-user") },
    error: null,
  });
  await expect(
    completeCallback({ code: "normal-oauth-code", next: "/reset-password" }),
  ).rejects.toThrow("RECOVERY_REQUIRED");
  expect(account).not.toHaveBeenCalled();
});

it.each([
  "?error_code=otp_expired",
  "#error_code=otp_expired",
  "?error_description=native_denial",
  "#error_description=native_denial",
])(
  "classifies standalone native error fields as failure rather than a no-code confirmation: %s",
  async (suffix) => {
    const { captureAuthCallback, capturedCallback } = await import("./callback");
    window.history.replaceState({}, "", `/auth/callback${suffix}`);
    try {
      captureAuthCallback();
      expect(capturedCallback().providerError).toBe(true);
      expect(window.location.search).toBe("");
      expect(window.location.hash).toBe("");
      await expect(completeCallback(capturedCallback())).rejects.toThrow("AUTH_CALLBACK_INVALID");
      expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    } finally {
      window.history.replaceState({}, "", "/");
    }
  },
);

function successfulExchange(session = nativeSession()) {
  auth.exchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
  auth.getSession.mockResolvedValue({ data: { session }, error: null });
  auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
}

it("shares one pinned platform account read across the callback and protected account route", async () => {
  successfulExchange();
  const queries = new QueryClient();
  expect(
    await completeCallback({ code: "callback-route-sharing", next: "/account" }, queries),
  ).toBe("/account");
  await loadPlatformAccount({ context: { queryClient: queries, authUserId: nativeUserId } });
  expect(auth.exchangeCodeForSession).toHaveBeenCalledOnce();
  expect(account).toHaveBeenCalledExactlyOnceWith(
    true,
    nativeSession().access_token,
    expect.any(AbortSignal),
  );
  expect(queries.getQueryData(accountQueryKeys.projection(nativeUserId, true))).toMatchObject({
    id: "domain-account",
  });
  expect(queries.getQueryData(accountQueryKeys.projection(nativeUserId))).toBeUndefined();
});

it("drops private data from the prior session before publishing the callback projection", async () => {
  successfulExchange();
  const queries = new QueryClient();
  queries.setQueryData(accountQueryKeys.projection(nativeUserId, true), { id: "old-account" });
  queries.setQueryData(["workspace", "old-account", null], { private: true });
  await completeCallback({ code: "callback-new-private-lifetime", next: "/account" }, queries);
  expect(account).toHaveBeenCalledExactlyOnceWith(
    true,
    nativeSession().access_token,
    expect.any(AbortSignal),
  );
  expect(queries.getQueryData(accountQueryKeys.projection(nativeUserId, true))).toMatchObject({
    id: "domain-account",
  });
  expect(queries.getQueryData(["workspace", "old-account", null])).toBeUndefined();
});

it("preserves the existing deletion recovery destination without reading the account", async () => {
  successfulExchange();
  sessionStorage.setItem(
    "ftk-account-deletion",
    JSON.stringify({
      actor: nativeUserId,
      operationKey: "019a7b00-0000-7000-8000-000000000201",
      preview: { id: "019a7b00-0000-7000-8000-000000000202", token: "fixture-preview" },
    }),
  );
  expect(
    await completeCallback(
      { code: "callback-deletion-receipt", next: "/account" },
      new QueryClient(),
    ),
  ).toBe("/account/deletion");
  expect(account).not.toHaveBeenCalled();
});

it.each([
  ["actor", nativeSession("other-native-user")],
  ["session", nativeSession(nativeUserId, "019a7b00-0000-7000-8000-000000000102")],
] as const)(
  "rejects a replaced native %s before starting the callback account read",
  async (kind, replacement) => {
    successfulExchange();
    auth.mfa.getAuthenticatorAssuranceLevel.mockImplementationOnce(async () => {
      auth.getSession.mockResolvedValue({ data: { session: replacement }, error: null });
      return { data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null };
    });
    const queries = new QueryClient();
    await expect(
      completeCallback({ code: `callback-replaced-${kind}`, next: "/account" }, queries),
    ).rejects.toThrow("ACCOUNT_CHANGED");
    expect(account).not.toHaveBeenCalled();
    expect(queries.getQueryData(accountQueryKeys.projection(nativeUserId, true))).toBeUndefined();
  },
);

it("rejects a late account response from the exchanged session after same-user reauthentication", async () => {
  successfulExchange();
  account.mockImplementationOnce(async () => {
    auth.getSession.mockResolvedValue({
      data: { session: nativeSession(nativeUserId, "019a7b00-0000-7000-8000-000000000103") },
      error: null,
    });
    return { id: "old-session-account" };
  });
  const queries = new QueryClient();
  await expect(
    completeCallback({ code: "callback-late-session-result", next: "/account" }, queries),
  ).rejects.toThrow("ACCOUNT_CHANGED");
  expect(account).toHaveBeenCalledExactlyOnceWith(
    true,
    nativeSession().access_token,
    expect.any(AbortSignal),
  );
  expect(queries.getQueryData(accountQueryKeys.projection(nativeUserId, true))).toBeUndefined();
});

it("accepts a refreshed bearer for the same exchanged native session", async () => {
  successfulExchange();
  account.mockImplementationOnce(async () => {
    auth.getSession.mockResolvedValue({
      data: { session: nativeSession(nativeUserId, firstSessionId, "refreshed") },
      error: null,
    });
    return { id: "domain-account" };
  });
  expect(
    await completeCallback({ code: "callback-token-refresh", next: "/account" }, new QueryClient()),
  ).toBe("/account");
  expect(account).toHaveBeenCalledExactlyOnceWith(
    true,
    nativeSession().access_token,
    expect.any(AbortSignal),
  );
});

it.each(["FORBIDDEN", "AUTH_REQUIRED", "SESSION_REVOKED"] as const)(
  "preserves native %s rejection instead of redirecting to a cached account",
  async (code) => {
    successfulExchange();
    const failure = new BackendError({ code, retryable: false, trace_id: "callback-fixture" });
    account.mockRejectedValueOnce(failure);
    const queries = new QueryClient();
    await expect(
      completeCallback({ code: `callback-denied-${code}`, next: "/account" }, queries),
    ).rejects.toBe(failure);
    expect(account).toHaveBeenCalledOnce();
    expect(queries.getQueryData(accountQueryKeys.projection(nativeUserId, true))).toBeUndefined();
  },
);
