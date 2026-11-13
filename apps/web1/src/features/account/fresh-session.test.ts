import { afterEach, expect, it, vi } from "vitest";
const { native, call } = vi.hoisted(() => ({
  native: {
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    getSession: vi.fn(),
    mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
  },
  call: vi.fn(),
}));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: native }) }));
vi.mock("../../lib/backend", () => ({ getBackend: () => ({ call }) }));
import { freshPasswordSession, prepareOthersIntent, revokeOthers } from "./fresh-session";
afterEach(() => vi.resetAllMocks());
it("creates a new native session only for the current provider identity", async () => {
  native.getUser.mockResolvedValue({
    data: { user: { id: "same", email: "fixture@example.invalid" } },
    error: null,
  });
  native.signInWithPassword.mockResolvedValue({
    data: { user: { id: "same" }, session: {} },
    error: null,
  });
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal2" },
    error: null,
  });
  await freshPasswordSession("fixture-password");
  expect(native.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  expect(native.signInWithPassword).toHaveBeenCalledExactlyOnceWith({
    email: "fixture@example.invalid",
    password: "fixture-password",
  });
});
it("never produces a revocation intent after provider denial or account mismatch", async () => {
  native.getUser.mockResolvedValue({
    data: { user: { id: "same", email: "fixture@example.invalid" } },
    error: null,
  });
  native.signInWithPassword.mockResolvedValue({
    data: { user: { id: "different" }, session: {} },
    error: null,
  });
  await expect(freshPasswordSession("fixture")).rejects.toThrow("AUTH_REQUIRED");
  expect(call).not.toHaveBeenCalled();
});
it("requires native MFA before capturing the proof", async () => {
  native.getSession.mockResolvedValue({
    data: { session: { access_token: "synthetic-proof" } },
    error: null,
  });
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal2" },
    error: null,
  });
  await expect(prepareOthersIntent()).rejects.toThrow("MFA_REQUIRED");
  expect(native.mfa.getAuthenticatorAssuranceLevel).toHaveBeenCalledExactlyOnceWith(
    "synthetic-proof",
  );
  expect(call).not.toHaveBeenCalled();
});
it("keeps the exact proof and key across uncertain retries even if the SDK token later refreshes", async () => {
  native.getSession.mockResolvedValue({
    data: { session: { access_token: "synthetic-proof" } },
    error: null,
  });
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal2", nextLevel: "aal2" },
    error: null,
  });
  const intent = await prepareOthersIntent();
  native.getSession.mockResolvedValue({
    data: { session: { access_token: "synthetic-refreshed" } },
    error: null,
  });
  call
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({ current_revoked: false });
  await expect(revokeOthers(intent)).rejects.toThrow("network");
  await revokeOthers(intent);
  expect(call).toHaveBeenCalledTimes(2);
  for (const [operation, request] of call.mock.calls) {
    expect(operation).toBe("account_sessions_revoke_v1");
    expect(request).toMatchObject({
      mode: "others",
      reauth: "synthetic-proof",
      operation_key: intent.operationKey,
    });
    expect(request).not.toHaveProperty("session_id");
  }
});
