import { afterEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
const { check, signup, account, assurance, session } = vi.hoisted(() => ({
  check: vi.fn(),
  signup: vi.fn(),
  account: vi.fn(),
  assurance: vi.fn(),
  session: vi.fn(),
}));
vi.mock("../../lib/public-gateway", () => ({ checkSignup: check }));
vi.mock("../../lib/account", () => ({ readAccount: account }));
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      signUp: signup,
      getSession: session,
      mfa: { getAuthenticatorAssuranceLevel: assurance },
    },
  }),
}));
import { registerAccount } from "./signup";
import { accountQueryKeys } from "./account-query";
import { loadPlatformAccount } from "./account-guard";
const values = {
  name: "Test Student",
  email: "fixture@example.invalid",
  password: "fixture-password",
};
function nativeSession(
  sessionId = "019a7b00-0000-7000-8000-000000000001",
  suffix = "original",
): Session {
  return {
    access_token: `fixture.${btoa(JSON.stringify({ sub: "signup-user", session_id: sessionId }))}.${suffix}`,
    refresh_token: "signup-refresh",
    token_type: "bearer",
    expires_in: 3600,
    user: {
      id: "signup-user",
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
      app_metadata: {},
      user_metadata: {},
    },
  };
}
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
  const currentSession = { user: { id: "fixture" }, access_token: "native-signup-fixture" };
  signup.mockResolvedValue({
    data: { user: { id: "fixture", identities: [{}] }, session: currentSession },
    error: null,
  });
  session.mockResolvedValue({ data: { session: currentSession }, error: null });
  assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
  expect(await registerAccount(values)).toBe("/mfa");
  expect(account).not.toHaveBeenCalled();
  assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  account.mockResolvedValue({ id: "signup-account" });
  expect(await registerAccount(values)).toBe("/account");
  expect(account).toHaveBeenCalledOnce();
});

it("shares the verified immediate-signup account with its route and drops prior private data", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  check.mockResolvedValue({ status: "available" });
  const currentSession = { user: { id: "signup-user" }, access_token: "signup-native-token" };
  signup.mockResolvedValue({
    data: { user: { id: "signup-user", identities: [{}] }, session: currentSession },
    error: null,
  });
  session.mockResolvedValue({ data: { session: currentSession }, error: null });
  assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  account.mockResolvedValue({ id: "signup-account" });
  const queries = new QueryClient();
  queries.setQueryData(["workspace", "prior-account", null], { private: true });
  expect(await registerAccount(values, queries)).toBe("/account");
  await loadPlatformAccount({ context: { queryClient: queries, authUserId: "signup-user" } });
  expect(account).toHaveBeenCalledExactlyOnceWith(
    true,
    "signup-native-token",
    expect.any(AbortSignal),
  );
  expect(queries.getQueryData(accountQueryKeys.projection("signup-user", true))).toEqual({
    id: "signup-account",
  });
  expect(queries.getQueryData(accountQueryKeys.projection("signup-user"))).toBeUndefined();
  expect(queries.getQueryData(["workspace", "prior-account", null])).toBeUndefined();
});

it("rejects an actor change before publishing an immediate-signup account", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  check.mockResolvedValue({ status: "available" });
  signup.mockResolvedValue({
    data: {
      user: { id: "signup-user", identities: [{}] },
      session: { user: { id: "signup-user" }, access_token: "signup-native-token" },
    },
    error: null,
  });
  session.mockResolvedValue({
    data: { session: { user: { id: "other-user" }, access_token: "other-native-token" } },
    error: null,
  });
  assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  const queries = new QueryClient();
  await expect(registerAccount(values, queries)).rejects.toThrow("ACCOUNT_CHANGED");
  expect(account).not.toHaveBeenCalled();
  expect(queries.getQueryData(accountQueryKeys.projection("signup-user", true))).toBeUndefined();
});

it("rejects a new session for the same signup user before its account or MFA redirect", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  check.mockResolvedValue({ status: "available" });
  const original = nativeSession();
  signup.mockResolvedValue({
    data: { user: { ...original.user, identities: [{}] }, session: original },
    error: null,
  });
  session.mockResolvedValue({
    data: { session: nativeSession("019a7b00-0000-7000-8000-000000000002") },
    error: null,
  });
  const queries = new QueryClient();
  for (const nextLevel of ["aal1", "aal2"]) {
    assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel }, error: null });
    await expect(registerAccount(values, queries)).rejects.toThrow("ACCOUNT_CHANGED");
  }
  expect(assurance).toHaveBeenCalledWith(original.access_token);
  expect(account).not.toHaveBeenCalled();
  expect(queries.getQueryData(accountQueryKeys.projection("signup-user", true))).toBeUndefined();
});

it("rejects a same-user session change while the signup account response is pending", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  check.mockResolvedValue({ status: "available" });
  const original = nativeSession();
  signup.mockResolvedValue({
    data: { user: { ...original.user, identities: [{}] }, session: original },
    error: null,
  });
  session.mockResolvedValue({ data: { session: original }, error: null });
  assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  account.mockImplementation(async () => {
    session.mockResolvedValue({
      data: { session: nativeSession("019a7b00-0000-7000-8000-000000000002") },
      error: null,
    });
    return { id: "signup-account" };
  });
  const queries = new QueryClient();
  await expect(registerAccount(values, queries)).rejects.toThrow("ACCOUNT_CHANGED");
  expect(account).toHaveBeenCalledExactlyOnceWith(
    true,
    original.access_token,
    expect.any(AbortSignal),
  );
  expect(queries.getQueryData(accountQueryKeys.projection("signup-user", true))).toBeUndefined();
});

it("accepts a normal token refresh in the originating signup session and shares the route", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  check.mockResolvedValue({ status: "available" });
  const original = nativeSession();
  const refreshed = nativeSession(undefined, "refreshed");
  signup.mockResolvedValue({
    data: { user: { ...original.user, identities: [{}] }, session: original },
    error: null,
  });
  session.mockResolvedValue({ data: { session: refreshed }, error: null });
  assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  account.mockResolvedValue({ id: "signup-account" });
  const queries = new QueryClient();
  expect(await registerAccount(values, queries)).toBe("/account");
  await loadPlatformAccount({ context: { queryClient: queries, authUserId: "signup-user" } });
  expect(assurance).toHaveBeenCalledExactlyOnceWith(original.access_token);
  expect(account).toHaveBeenCalledExactlyOnceWith(
    true,
    refreshed.access_token,
    expect.any(AbortSignal),
  );
});
