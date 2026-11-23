import { afterEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { accountQuery, accountQueryKeys } from "./account-query";

const { native, account } = vi.hoisted(() => ({
  native: {
    signInWithPassword: vi.fn(),
    getSession: vi.fn(),
    mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
  },
  account: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: native }) }));
vi.mock("../../lib/account", () => ({ readAccount: account }));

import { loginWithPassword } from "./auth";

const userId = "019a7b00-0000-7000-8000-000000000001";

function authenticated(user = userId, token = "native-token") {
  native.signInWithPassword.mockResolvedValue({
    data: { session: { user: { id: user } } },
    error: null,
  });
  native.getSession.mockResolvedValue({
    data: { session: { user: { id: user }, access_token: token } },
    error: null,
  });
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
}

afterEach(() => vi.resetAllMocks());

it("shares the verified post-login account read with the protected route", async () => {
  authenticated();
  account.mockResolvedValue({ id: "account-a", display_name: "Fixture" });
  const queries = new QueryClient();
  const destination = await loginWithPassword(
    { email: "test@example.invalid", password: "fixture" },
    queries,
  );
  expect(destination).toBe("/account");
  const projection = await queries.query(accountQuery(userId, true));
  expect(projection.id).toBe("account-a");
  expect(account).toHaveBeenCalledExactlyOnceWith(true, "native-token", expect.any(AbortSignal));
  expect(queries.getQueryData(accountQueryKeys.projection(userId, true))).toBe(projection);
});

it("discards all prior private data when the same native user signs in again", async () => {
  authenticated(userId, "new-session-token");
  const queries = new QueryClient();
  queries.setQueryData(accountQueryKeys.projection(userId, true), { id: "stale-account" });
  queries.setQueryData(["workspace", "stale-account", null], { private: true });
  account.mockResolvedValue({ id: "current-account" });
  await loginWithPassword({ email: "test@example.invalid", password: "fixture" }, queries);
  expect(account).toHaveBeenCalledExactlyOnceWith(
    true,
    "new-session-token",
    expect.any(AbortSignal),
  );
  expect(queries.getQueryData(accountQueryKeys.projection(userId, true))).toMatchObject({
    id: "current-account",
  });
  expect(queries.getQueryData(["workspace", "stale-account", null])).toBeUndefined();
});

it("rejects a changed native actor before publishing a cached account", async () => {
  authenticated();
  native.getSession.mockResolvedValue({
    data: {
      session: { user: { id: "different-user" }, access_token: "foreign-token" },
    },
    error: null,
  });
  const queries = new QueryClient();
  await expect(
    loginWithPassword({ email: "test@example.invalid", password: "fixture" }, queries),
  ).rejects.toThrow("ACCOUNT_CHANGED");
  expect(account).not.toHaveBeenCalled();
  expect(queries.getQueryData(accountQueryKeys.projection(userId, true))).toBeUndefined();
});
