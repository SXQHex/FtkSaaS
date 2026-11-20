import { afterEach, expect, it, vi } from "vitest";
const { check, signup, account, assurance } = vi.hoisted(() => ({
  check: vi.fn(),
  signup: vi.fn(),
  account: vi.fn(),
  assurance: vi.fn(),
}));
vi.mock("../../lib/public-gateway", () => ({ checkSignup: check }));
vi.mock("../../lib/account", () => ({ readAccount: account }));
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      signUp: signup,
      mfa: { getAuthenticatorAssuranceLevel: assurance },
    },
  }),
}));
import { registerAccount } from "./signup";
const values = {
  name: "Test Student",
  email: "fixture@example.invalid",
  password: "fixture-password",
};
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("stops existing or failed prechecks without native signup or resend", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  check.mockResolvedValue({ status: "account_exists" });
  await expect(registerAccount(values)).rejects.toThrow("ACCOUNT_EXISTS");
  check.mockRejectedValue(new Error("unavailable"));
  await expect(registerAccount(values)).rejects.toThrow("unavailable");
  expect(signup).not.toHaveBeenCalled();
});
it("performs one native PKCE signup after availability and waits for verification", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  check.mockResolvedValue({ status: "available" });
  signup.mockResolvedValue({
    data: { user: { id: "fixture-user", identities: [{}] }, session: null },
    error: null,
  });
  expect(await registerAccount(values)).toBe("/verify-email");
  expect(check).toHaveBeenCalledExactlyOnceWith(values.email);
  expect(signup).toHaveBeenCalledExactlyOnceWith({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: "https://app.example.invalid/auth/callback",
      data: { display_name: values.name },
    },
  });
  expect(account).not.toHaveBeenCalled();
});
it("does not claim success or retry after provider failure or concealed duplicate", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  check.mockResolvedValue({ status: "available" });
  signup.mockResolvedValue({ data: { user: null, session: null }, error: new Error("rejected") });
  await expect(registerAccount(values)).rejects.toThrow("rejected");
  expect(signup).toHaveBeenCalledTimes(1);
  signup.mockResolvedValue({
    data: { user: { id: "fake", identities: [] }, session: null },
    error: null,
  });
  await expect(registerAccount(values)).rejects.toThrow("ACCOUNT_EXISTS");
});
it("handles a real immediate session with the same MFA and account gate as sign in", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  check.mockResolvedValue({ status: "available" });
  signup.mockResolvedValue({
    data: { user: { id: "fixture", identities: [{}] }, session: {} },
    error: null,
  });
  assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
  expect(await registerAccount(values)).toBe("/mfa");
  expect(account).not.toHaveBeenCalled();
  assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  expect(await registerAccount(values)).toBe("/account");
  expect(account).toHaveBeenCalledOnce();
});
