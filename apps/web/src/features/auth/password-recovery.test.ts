import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { auth } = vi.hoisted(() => ({
  auth: {
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    getSession: vi.fn(),
    getClaims: vi.fn(),
    signOut: vi.fn(),
  },
}));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth }) }));
import { requestPasswordReset, saveRecoveredPassword } from "./password-recovery";
beforeEach(() =>
  auth.getClaims.mockResolvedValue({
    data: { claims: { sub: "recovery-account", session_id: "native-session-one" } },
    error: null,
  }),
);
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  sessionStorage.clear();
});
it("starts native recovery with the explicit SPA recovery callback", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  await requestPasswordReset("fixture@example.invalid");
  expect(auth.resetPasswordForEmail).toHaveBeenCalledExactlyOnceWith("fixture@example.invalid", {
    redirectTo: "https://app.example.invalid/auth/callback?next=/reset-password",
  });
});
it("keeps the current recovery session after a native password save", async () => {
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "recovery-account" } } },
    error: null,
  });
  auth.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
  sessionStorage.setItem("ftk-recovery-account", "recovery-account:native-session-one");
  await saveRecoveredPassword("fixture-new-password");
  expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: "fixture-new-password" });
  expect(auth.signOut).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("ftk-recovery-account")).toBeNull();
});
it("does not offer recovery password update for an unrelated normal session", async () => {
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "other-account" } } },
    error: null,
  });
  sessionStorage.setItem("ftk-recovery-account", "recovery-account:native-session-one");
  await expect(saveRecoveredPassword("fixture-new-password")).rejects.toThrow("RECOVERY_REQUIRED");
  expect(auth.updateUser).not.toHaveBeenCalled();
});
it("preserves native rejection and does not turn it into a success", async () => {
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "recovery-account" } } },
    error: null,
  });
  auth.updateUser.mockResolvedValue({ error: new Error("weak_password") });
  sessionStorage.setItem("ftk-recovery-account", "recovery-account:native-session-one");
  await expect(saveRecoveredPassword("fixture-new-password")).rejects.toThrow("weak_password");
});

it("does not reuse recovery proof for a new normal session of the same account", async () => {
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "recovery-account" } } },
    error: null,
  });
  auth.getClaims.mockResolvedValue({
    data: { claims: { sub: "recovery-account", session_id: "different-native-session" } },
    error: null,
  });
  sessionStorage.setItem("ftk-recovery-account", "recovery-account:native-session-one");
  await expect(saveRecoveredPassword("fixture-new-password")).rejects.toThrow("RECOVERY_REQUIRED");
  expect(auth.updateUser).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("ftk-recovery-account")).toBeNull();
});
