import { afterEach, expect, it, vi } from "vitest";
const { auth, account } = vi.hoisted(() => ({
  auth: { exchangeCodeForSession: vi.fn(), mfa: { getAuthenticatorAssuranceLevel: vi.fn() } },
  account: vi.fn(),
}));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth }) }));
vi.mock("../../lib/account", () => ({ readAccount: account }));
import { completeCallback, safeNext } from "./callback";
afterEach(() => vi.resetAllMocks());
it.each(["https://evil.invalid", "//evil.invalid", "/account?redirect=evil", "/unknown"])(
  "rejects external or unlisted next %s",
  (next) => expect(safeNext(next)).toBe("/account"),
);
it("exchanges a code once even if the route is requested twice", async () => {
  auth.exchangeCodeForSession.mockResolvedValue({
    data: { session: {}, redirectType: null },
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
    data: { session: {}, redirectType: null },
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
