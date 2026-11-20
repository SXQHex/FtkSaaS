import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { native, call, backend, readAccount } = vi.hoisted(() => ({
  native: {
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    getSession: vi.fn(),
    mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
  },
  call: vi.fn(),
  backend: vi.fn(),
  readAccount: vi.fn(),
}));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: native }) }));
vi.mock("../../lib/backend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/backend")>()),
  getBackend: backend,
}));
vi.mock("../../lib/account", () => ({ readAccount }));
vi.mock("../auth/password-recovery", () => ({ hasRecoverySession: async () => false }));
import { freshPasswordSession, prepareOthersIntent, revokeOthers } from "./fresh-session";
import { continueAfterMfa } from "../auth/mfa";

const nativeUser = { id: "019a7b00-0000-7000-8000-000000000001", email: "fixture@example.invalid" };
const previous = "019a7b00-0000-7000-8000-000000000002";
const replacement = "019a7b00-0000-7000-8000-000000000003";
const other = "019a7b00-0000-7000-8000-000000000004";
function session(id: string, aal = "aal1") {
  const payload = btoa(JSON.stringify({ sub: nativeUser.id, session_id: id, aal }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  return { user: nativeUser, access_token: `synthetic.${payload}.fixture` };
}
function beginReplacement() {
  native.getUser.mockResolvedValue({ data: { user: nativeUser }, error: null });
  native.getSession.mockResolvedValue({ data: { session: session(previous) }, error: null });
  native.signInWithPassword.mockImplementation(async () => {
    const next = session(replacement);
    native.getSession.mockResolvedValue({ data: { session: next }, error: null });
    return { data: { user: nativeUser, session: next }, error: null };
  });
}
beforeEach(() => {
  backend.mockReturnValue({ call });
});
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
it("creates a new native session only for the current provider identity", async () => {
  beginReplacement();
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
  beginReplacement();
  native.signInWithPassword.mockResolvedValueOnce({ error: new Error("invalid_credentials") });
  await expect(freshPasswordSession("wrong-password")).rejects.toThrow("invalid_credentials");
  native.signInWithPassword.mockResolvedValue({
    data: { user: { id: "different" }, session: {} },
    error: null,
  });
  await expect(freshPasswordSession("fixture")).rejects.toThrow("AUTH_REQUIRED");
  expect(call).not.toHaveBeenCalled();
});
it("retires only the captured previous session with the verified replacement's token", async () => {
  beginReplacement();
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
  await freshPasswordSession("fixture-password");
  expect(call).not.toHaveBeenCalled();
  await prepareOthersIntent();
  expect(backend).toHaveBeenCalledExactlyOnceWith(session(replacement).access_token);
  expect(call).toHaveBeenCalledExactlyOnceWith(
    "account_sessions_revoke_v1",
    expect.objectContaining({ mode: "selected", session_id: previous }),
  );
  await prepareOthersIntent();
  expect(call).toHaveBeenCalledTimes(1);
});
it("keeps the previous session until MFA succeeds for the exact replacement", async () => {
  beginReplacement();
  await freshPasswordSession("fixture-password");
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal2" },
    error: null,
  });
  await expect(prepareOthersIntent()).rejects.toThrow("MFA_REQUIRED");
  expect(call).not.toHaveBeenCalled();
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal2", nextLevel: "aal2" },
    error: null,
  });
  native.getSession.mockResolvedValue({ data: { session: session(other, "aal2") }, error: null });
  await continueAfterMfa();
  expect(call).not.toHaveBeenCalled();
  native.getSession.mockResolvedValue({
    data: { session: session(replacement, "aal2") },
    error: null,
  });
  await continueAfterMfa();
  expect(backend).toHaveBeenCalledExactlyOnceWith(session(replacement, "aal2").access_token);
  expect(call).toHaveBeenCalledExactlyOnceWith(
    "account_sessions_revoke_v1",
    expect.objectContaining({ mode: "selected", session_id: previous }),
  );
});
it("retries the exact ending operation after a lost response", async () => {
  beginReplacement();
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
  await freshPasswordSession("fixture-password");
  call.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ affected_count: 1 });
  await expect(prepareOthersIntent()).rejects.toThrow("network");
  await prepareOthersIntent();
  expect(call).toHaveBeenCalledTimes(2);
  expect(call.mock.calls[0][1]).toMatchObject({ mode: "selected", session_id: previous });
  expect(call.mock.calls[1][1].operation_key).toBe(call.mock.calls[0][1].operation_key);
  expect(call.mock.calls[1][1].request_id).not.toBe(call.mock.calls[0][1].request_id);
  expect(native.signInWithPassword).toHaveBeenCalledTimes(1);
});
it("serializes overlapping replacements around the browser's native session", async () => {
  let available: Promise<unknown> = Promise.resolve();
  const request = vi.fn((_name: string, callback: () => Promise<unknown>) => {
    const result = available.then(callback);
    available = result.catch(() => undefined);
    return result;
  });
  vi.stubGlobal("navigator", { locks: { request } });
  beginReplacement();
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
  native.signInWithPassword
    .mockImplementationOnce(async () => {
      const next = session(replacement);
      native.getSession.mockResolvedValue({ data: { session: next }, error: null });
      return { data: { user: nativeUser, session: next }, error: null };
    })
    .mockImplementationOnce(async () => {
      expect(call).toHaveBeenCalledExactlyOnceWith(
        "account_sessions_revoke_v1",
        expect.objectContaining({ mode: "selected", session_id: previous }),
      );
      const next = session(other);
      native.getSession.mockResolvedValue({ data: { session: next }, error: null });
      return { data: { user: nativeUser, session: next }, error: null };
    });
  await Promise.all([freshPasswordSession("fixture-one"), freshPasswordSession("fixture-two")]);
  await prepareOthersIntent();
  expect(request).toHaveBeenCalledTimes(3);
  expect(new Set(request.mock.calls.map(([name]) => name)).size).toBe(1);
  expect(backend.mock.calls).toEqual([
    [session(replacement).access_token],
    [session(other).access_token],
  ]);
  expect(call.mock.calls.map(([, payload]) => payload.session_id)).toEqual([previous, replacement]);
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
