import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
beforeEach(() =>
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
);
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
    data: { session: { user: { id: "019a7b00-0000-7000-8000-000000000001" } }, redirectType: null },
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
    data: { session: { user: { id: "019a7b00-0000-7000-8000-000000000001" } }, redirectType: null },
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
    data: { session: { user: { id: "native-recovery-user" } } },
    error: null,
  });
  auth.exchangeCodeForSession.mockImplementation(async () => {
    auth.onAuthStateChange.mock.calls[0][0]("PASSWORD_RECOVERY", {
      user: { id: "native-recovery-user" },
    });
    return { data: { session: { user: { id: "native-recovery-user" } } }, error: null };
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
});
it("does not turn a normal OAuth session into a recovery session by changing next", async () => {
  auth.exchangeCodeForSession.mockResolvedValue({
    data: { session: { user: { id: "normal-user" } } },
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
