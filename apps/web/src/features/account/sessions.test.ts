import { afterEach, expect, it, vi } from "vitest";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/backend", () => ({ getBackend: () => ({ call }) }));
import { readSessions, saveSessionLabel, revokeSession } from "./sessions";
afterEach(() => vi.resetAllMocks());
it("uses an account-scoped cursor without adding org or actor selectors", async () => {
  call.mockResolvedValue({ items: [], next_cursor: null });
  await readSessions("opaque");
  expect(call).toHaveBeenCalledWith("account_sessions_list_v1", {
    client_api_version: 1,
    request_id: expect.any(String),
    cursor: "opaque",
  });
});
it("keeps provider session UUIDs, expected versions and intent keys unchanged", async () => {
  call.mockResolvedValue({ version: 3 });
  await saveSessionLabel({
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    version: 2,
    label: "  Laptop  ",
    operationKey: "intent",
  });
  expect(call).toHaveBeenCalledWith("account_session_label_v1", {
    client_api_version: 1,
    request_id: expect.any(String),
    session_id: "550e8400-e29b-41d4-a716-446655440000",
    expected_version: 2,
    operation_key: "intent",
    label: "Laptop",
  });
});
it("clears a blank label with null and rejects an overlong label before the write", async () => {
  await saveSessionLabel({ sessionId: "provider", version: 0, label: " ", operationKey: "intent" });
  expect(call.mock.calls[0][1].label).toBeNull();
  await expect(
    saveSessionLabel({
      sessionId: "provider",
      version: 0,
      label: "a".repeat(81),
      operationKey: "intent",
    }),
  ).rejects.toThrow("LABEL_INVALID");
  expect(call).toHaveBeenCalledOnce();
});
it("retries only the same selected target and intent key and propagates native backend denial", async () => {
  call
    .mockRejectedValueOnce(new Error("FORBIDDEN"))
    .mockResolvedValueOnce({ affected_count: 1, current_revoked: false });
  await expect(revokeSession("chosen", "intent")).rejects.toThrow("FORBIDDEN");
  await revokeSession("chosen", "intent");
  for (const [, request] of call.mock.calls)
    expect(request).toMatchObject({
      mode: "selected",
      session_id: "chosen",
      operation_key: "intent",
    });
  expect(call.mock.calls[0][1]).not.toHaveProperty("reauth");
});

it("counts Unicode code points consistently with the contract rather than UTF-16 units", async () => {
  await saveSessionLabel({
    sessionId: "provider",
    version: 0,
    label: "😀".repeat(80),
    operationKey: "intent",
  });
  expect(call.mock.calls[0][1].label).toBe("😀".repeat(80));
  await expect(
    saveSessionLabel({
      sessionId: "provider",
      version: 0,
      label: "😀".repeat(81),
      operationKey: "intent",
    }),
  ).rejects.toThrow("LABEL_INVALID");
  expect(call).toHaveBeenCalledOnce();
});
