import { afterEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { accountQuery, accountQueryKeys } from "./account-query";
const { native, account } = vi.hoisted(() => ({
  native: {
    signInWithPassword: vi.fn(),
    getSession: vi.fn(),
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
  const queries = new QueryClient();
  native.getSession.mockResolvedValue({
    data: {
      session: {
        user: { id: "019a7b00-0000-7000-8000-000000000001" },
        access_token: "native-token",
      },
    },
    error: null,
  });
  account.mockResolvedValue({ id: "account" });
  const destination = await loginWithPassword(
    { email: "test@example.invalid", password: "fixture" },
    queries,
  );
  expect(destination).toBe("/account");
  expect(account).toHaveBeenCalledExactlyOnceWith(true, "native-token");
  expect(
    queries.getQueryData(accountQueryKeys.projection("019a7b00-0000-7000-8000-000000000001", true)),
  ).toMatchObject({ id: "account" });
  // Route loader reads the same fresh Query projection without a second backend call.
  const routed = await queries.query(accountQuery("019a7b00-0000-7000-8000-000000000001", true));
  expect(routed).toMatchObject({ id: "account" });
  expect(account).toHaveBeenCalledOnce();
});
it("rechecks an existing projection when the same native user signs in again", async () => {
  const userId = "019a7b00-0000-7000-8000-000000000001";
  native.signInWithPassword.mockResolvedValue({
    data: { session: { user: { id: userId } } },
    error: null,
  });
  native.getSession.mockResolvedValue({
    data: { session: { user: { id: userId }, access_token: "new-session-token" } },
    error: null,
  });
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
  const queries = new QueryClient();
  const key = accountQueryKeys.projection(userId, true);
  queries.setQueryData(key, { id: "stale-account" });
  queries.setQueryData(["workspace", "stale-account", null], { private: true });
  account.mockResolvedValue({ id: "current-account" });
  await loginWithPassword({ email: "test@example.invalid", password: "fixture" }, queries);
  expect(account).toHaveBeenCalledExactlyOnceWith(true, "new-session-token");
  expect(queries.getQueryData(key)).toMatchObject({ id: "current-account" });
  expect(queries.getQueryData(["workspace", "stale-account", null])).toBeUndefined();
});

it("rejects a session switch before publishing an account projection", async () => {
  const userId = "019a7b00-0000-7000-8000-000000000001";
  native.signInWithPassword.mockResolvedValue({
    data: { session: { user: { id: userId } } },
    error: null,
  });
  native.getSession.mockResolvedValue({
    data: { session: { user: { id: "another-native-user" }, access_token: "token" } },
    error: null,
  });
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
  const queries = new QueryClient();
  await expect(
    loginWithPassword({ email: "test@example.invalid", password: "fixture" }, queries),
  ).rejects.toThrow("ACCOUNT_CHANGED");
  expect(account).not.toHaveBeenCalled();
  expect(queries.getQueryData(accountQueryKeys.projection(userId, true))).toBeUndefined();
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
  expect(
    await loginWithPassword(
      { email: "test@example.invalid", password: "fixture" },
      new QueryClient(),
    ),
  ).toBe("/mfa");
  expect(account).not.toHaveBeenCalled();
});
it("does not read an account after provider denial", async () => {
  native.signInWithPassword.mockResolvedValue({
    data: { session: null },
    error: new Error("invalid"),
  });
  await expect(
    loginWithPassword(
      { email: "test@example.invalid", password: "fixture" },
      new QueryClient(),
    ),
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
