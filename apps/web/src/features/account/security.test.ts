import { afterEach, expect, it, vi } from "vitest";
const { native, call } = vi.hoisted(() => ({
  native: {
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challengeAndVerify: vi.fn(),
    unenroll: vi.fn(),
    getAuthenticatorAssuranceLevel: vi.fn(),
  },
  call: vi.fn(),
}));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: { mfa: native } }) }));
vi.mock("../../lib/backend", () => ({ getBackend: () => ({ call }) }));
import { removeTotpFactor, confirmTotpSetup, enrollTotp, readSecurityHistory } from "./security";
afterEach(() => vi.resetAllMocks());
it("enrolls native TOTP without making up recovery codes or provider settings", async () => {
  native.enroll.mockResolvedValue({
    data: {
      id: "pending",
      type: "totp",
      totp: { secret: "synthetic", qr_code: "data:image/svg+xml,synthetic" },
    },
    error: null,
  });
  expect((await enrollTotp()).id).toBe("pending");
  expect(native.enroll).toHaveBeenCalledExactlyOnceWith({ factorType: "totp" });
});
it("keeps enrollment incomplete when verification or the current assurance fails", async () => {
  await expect(confirmTotpSetup("pending", "12a456")).rejects.toThrow("MFA_CODE_INVALID");
  expect(native.challengeAndVerify).not.toHaveBeenCalled();
  native.challengeAndVerify
    .mockResolvedValueOnce({ error: new Error("denied") })
    .mockResolvedValueOnce({ error: null });
  await expect(confirmTotpSetup("pending", "123456")).rejects.toThrow("denied");
  native.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1" },
    error: null,
  });
  await expect(confirmTotpSetup("pending", "123456")).rejects.toThrow("MFA_REQUIRED");
});
it("uses native verification and requires its resulting AAL2 session", async () => {
  native.challengeAndVerify.mockResolvedValue({ error: null });
  native.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal2" },
    error: null,
  });
  await confirmTotpSetup("pending", "123456");
  expect(native.challengeAndVerify).toHaveBeenCalledExactlyOnceWith({
    factorId: "pending",
    code: "123456",
  });
});
it("removes only the explicitly confirmed native factor and propagates denial", async () => {
  native.unenroll
    .mockResolvedValueOnce({ error: null })
    .mockResolvedValueOnce({ error: new Error("aal2-required") });
  await removeTotpFactor("chosen");
  expect(native.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId: "chosen" });
  await expect(removeTotpFactor("another")).rejects.toThrow("aal2-required");
  expect(native.listFactors).not.toHaveBeenCalled();
});
it("passes the security history cursor to the typed account-scoped reader", async () => {
  call.mockResolvedValue({ items: [], next_cursor: null });
  await readSecurityHistory("opaque-cursor");
  expect(call).toHaveBeenCalledWith("account_security_history_get_v1", {
    client_api_version: 1,
    request_id: expect.any(String),
    cursor: "opaque-cursor",
  });
});
