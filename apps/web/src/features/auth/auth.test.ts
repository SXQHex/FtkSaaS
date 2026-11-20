import { afterEach, expect, it, vi } from "vitest";
const { native, account } = vi.hoisted(() => ({
  native: {
    signInWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
  },
  account: vi.fn(),
}));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: native }) }));
vi.mock("../../lib/account", () => ({ readAccount: account }));
import { loginWithPassword, loginWithGoogle } from "./auth";
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("reads the current account only after native authentication", async () => {
  native.signInWithPassword.mockResolvedValue({
    data: { session: { user: { id: "019a7b00-0000-7000-8000-000000000001" } } },
    error: null,
  });
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
  account.mockResolvedValue({ id: "account" });
  expect(await loginWithPassword({ email: "test@example.invalid", password: "fixture" })).toBe(
    "/account",
  );
  expect(account).toHaveBeenCalledOnce();
});
it("keeps account data closed while AAL2 is required", async () => {
  native.signInWithPassword.mockResolvedValue({
    data: { session: { user: { id: "019a7b00-0000-7000-8000-000000000001" } } },
    error: null,
  });
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal2" },
    error: null,
  });
  expect(await loginWithPassword({ email: "test@example.invalid", password: "fixture" })).toBe(
    "/mfa",
  );
  expect(account).not.toHaveBeenCalled();
});
it("does not read an account after provider denial", async () => {
  native.signInWithPassword.mockResolvedValue({
    data: { session: null },
    error: new Error("invalid"),
  });
  await expect(
    loginWithPassword({ email: "test@example.invalid", password: "fixture" }),
  ).rejects.toThrow();
  expect(account).not.toHaveBeenCalled();
});
it("uses the explicit configured SPA callback for Google", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  native.signInWithOAuth.mockResolvedValue({ error: null });
  await loginWithGoogle();
  expect(native.signInWithOAuth).toHaveBeenCalledExactlyOnceWith({
    provider: "google",
    options: { redirectTo: "https://app.example.invalid/auth/callback" },
  });
});
