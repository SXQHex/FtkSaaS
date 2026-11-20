import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { native, account, recovery } = vi.hoisted(() => ({
  native: {
    getSession: vi.fn(),
    listFactors: vi.fn(),
    challengeAndVerify: vi.fn(),
    getAuthenticatorAssuranceLevel: vi.fn(),
  },
  account: vi.fn(),
  recovery: vi.fn(),
}));
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({ auth: { mfa: native, getSession: native.getSession } }),
}));
vi.mock("../../lib/account", () => ({ readAccount: account }));
vi.mock("./password-recovery", () => ({ hasRecoverySession: recovery }));
import { continueAfterMfa, verifyTotp } from "./mfa";
beforeEach(() =>
  native.getSession.mockResolvedValue({
    data: { session: { user: { id: "019a7b00-0000-7000-8000-000000000001" } } },
    error: null,
  }),
);
afterEach(() => vi.resetAllMocks());
function factors() {
  native.listFactors.mockResolvedValue({
    data: {
      totp: [
        { id: "verified", status: "verified" },
        { id: "pending", status: "unverified" },
      ],
    },
    error: null,
  });
}
it("does not challenge malformed codes or a removed/unverified factor", async () => {
  factors();
  await expect(verifyTotp("verified", "12abc3")).rejects.toThrow("MFA_CODE_INVALID");
  await expect(verifyTotp("pending", "123456")).rejects.toThrow("MFA_FACTOR_REQUIRED");
  await expect(verifyTotp("removed", "123456")).rejects.toThrow("MFA_FACTOR_REQUIRED");
  expect(native.challengeAndVerify).not.toHaveBeenCalled();
});
it("keeps the target closed on native denial", async () => {
  factors();
  native.challengeAndVerify.mockResolvedValue({ error: new Error("denied") });
  await expect(verifyTotp("verified", "123456")).rejects.toThrow("denied");
  expect(account).not.toHaveBeenCalled();
});
it("requires the current native AAL2 session after successful verification", async () => {
  factors();
  native.challengeAndVerify.mockResolvedValue({ error: null });
  native.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal2" },
    error: null,
  });
  await expect(verifyTotp("verified", "123456")).rejects.toThrow("MFA_REQUIRED");
  expect(native.challengeAndVerify).toHaveBeenCalledExactlyOnceWith({
    factorId: "verified",
    code: "123456",
  });
  expect(account).not.toHaveBeenCalled();
});
it("uses the elevated native session before reading the protected account", async () => {
  factors();
  native.challengeAndVerify.mockResolvedValue({ error: null });
  native.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal2", nextLevel: "aal2" },
    error: null,
  });
  recovery.mockResolvedValue(false);
  await verifyTotp("verified", "123456");
  expect(await continueAfterMfa()).toBe("/account");
  expect(native.challengeAndVerify.mock.invocationCallOrder[0]).toBeLessThan(
    account.mock.invocationCallOrder[0],
  );
});
it("preserves a verified recovery destination and does not bypass a failed account read", async () => {
  native.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal2" },
    error: null,
  });
  recovery.mockResolvedValue(true);
  account.mockRejectedValueOnce(new Error("network"));
  await expect(continueAfterMfa()).rejects.toThrow("network");
  expect(recovery).not.toHaveBeenCalled();
  expect(await continueAfterMfa()).toBe("/reset-password");
  expect(native.challengeAndVerify).not.toHaveBeenCalled();
});
