import { beforeEach, expect, it, vi } from "vitest";
import type {
  ReservationView,
  SessionView,
  EntitlementView,
  ManagementStatePage,
} from "../../lib/api-contracts/generated";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  readCancellation,
  cancellationIntent,
  writeCancellation,
  readCancellationReceipt,
  readCancellationResult,
} from "./cancellation";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`,
  scope = { accountId: id(2), orgId: id(3), centerId: id(4) },
  personId = id(6),
  resId = id(83),
  sessionId = id(8);
let row: ReservationView, meta: ManagementStatePage;
const session: SessionView = {
  id: sessionId,
  class_id: null,
  format: "group",
  starts_at: "2026-11-17T10:00:00Z",
  ends_at: "2026-11-17T11:00:00Z",
  state: "planned",
  attendance_state: "open",
  assignments: [],
  discipline_id: id(9),
  version: 4,
  capacity: {
    total: 8,
    held: 0,
    remaining: 8,
    category_held: null,
    category_remaining: null,
    room_capacity: null,
  },
};
const rights: EntitlementView = {
  sale_id: id(70),
  person_id: personId,
  product_version_id: id(71),
  start_date: "2026-11-16",
  end_date: "2026-11-22",
  timezone: "Europe/Istanbul",
  state: "active",
  kind: "credits",
  booking_mode: "flexible",
  available: 7,
  reserved: 0,
  consumed: 1,
  deficit: 0,
  quotas: [],
  deficit_scopes: [],
  version: 1,
  sale_version: 1,
};
beforeEach(() => {
  row = {
    id: resId,
    session_id: sessionId,
    person_id: personId,
    state: "active",
    mode: "flexible",
    version: 2,
  };
  meta = {
    items: [
      {
        operation: "reservation_cancel_v1",
        state: "active",
        as_of: "2026-11-16T10:00:00Z",
        entity: { type: "reservations", id: resId },
        exists: true,
        current: { operation: "reservation_cancel_v1", values: { reservation_id: resId } },
        versions: [{ entity: { type: "reservations", id: resId }, version: 2 }],
      },
    ],
    next_cursor: null,
    as_of: "2026-11-16T10:00:00Z",
  };
  call.mockReset();
  call.mockImplementation(async (op) => {
    if (op === "management_state_get_v1") return meta;
    if (op === "reservation_list_v1")
      return { items: [row], next_cursor: null, as_of: "2026-11-16T10:00:00Z" };
    if (op === "reservation_cancel_v1") return { primary_id: resId, changed: [], jobs: [] };
    if (op === "session_get_v1") return session;
    if (op === "entitlements_get_v1") return [rights];
    throw new Error("UNEXPECTED_OPERATION");
  });
});
it("binds live action authority and version to the exact member/session before making a cancellation intent", async () => {
  const base = await readCancellation(scope, personId, resId, sessionId);
  expect(base.reservation.version).toBe(2);
  expect(call.mock.calls[0]).toEqual([
    "management_state_get_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: "reservation_cancel_v1",
      selector: { operation: "reservation_cancel_v1", key: { reservation_id: resId } },
    }),
  ]);
  expect(call.mock.calls[1]![1]).toMatchObject({ person_id: personId, session_id: sessionId });
  const intent = cancellationIntent(base, "  Synthetic cancellation  ");
  expect(intent.request).toMatchObject({
    expected_version: 2,
    reservation_id: resId,
    reason: "Synthetic cancellation",
  });
  expect(intent.request).not.toHaveProperty("refund");
  expect(() => cancellationIntent(base, " ")).toThrow();
});
it("rejects foreign member/session rows, stale versions and non-active reservations before writing", async () => {
  row.person_id = id(99);
  await expect(readCancellation(scope, personId, resId, sessionId)).rejects.toThrow(
    "PROFILE_CANCELLATION_UNAVAILABLE",
  );
  row.person_id = personId;
  row.session_id = id(99);
  await expect(readCancellation(scope, personId, resId, sessionId)).rejects.toThrow(
    "PROFILE_CANCELLATION_UNAVAILABLE",
  );
  row.session_id = sessionId;
  row.version = 3;
  await expect(readCancellation(scope, personId, resId, sessionId)).rejects.toThrow(
    "PROFILE_CANCELLATION_UNAVAILABLE",
  );
  row.version = 2;
  row.state = "cancelled";
  await expect(readCancellation(scope, personId, resId, sessionId)).rejects.toThrow(
    "PROFILE_CANCELLATION_UNAVAILABLE",
  );
  expect(call.mock.calls.some((x) => x[0] === "reservation_cancel_v1")).toBe(false);
});
it("retries the same frozen intent/key/version with fresh technical request IDs", async () => {
  const intent = cancellationIntent(
    await readCancellation(scope, personId, resId, sessionId),
    "Synthetic reason",
  );
  row.version = 9;
  await writeCancellation(intent);
  await writeCancellation(intent);
  const writes = call.mock.calls.filter((x) => x[0] === "reservation_cancel_v1");
  expect(writes).toHaveLength(2);
  expect(writes[0]![1].request_id).not.toBe(writes[1]![1].request_id);
  expect({ ...writes[0]![1], request_id: null }).toEqual({ ...writes[1]![1], request_id: null });
  expect(writes[0]![1].expected_version).toBe(2);
});
it("rejects another reservation or object type in the native operation receipt", async () => {
  const intent = cancellationIntent(
    await readCancellation(scope, personId, resId, sessionId),
    "Synthetic reason",
  );
  for (const reference of [
    { type: "sales", id: resId },
    { type: "reservations", id: id(99) },
  ]) {
    call.mockResolvedValueOnce({
      operation: intent.operation,
      key: intent.request.operation_key,
      status: "succeeded",
      result_available: true,
      result_reference: reference,
    });
    await expect(readCancellationReceipt(intent)).rejects.toThrow(
      "PROFILE_CANCELLATION_RECEIPT_UNAVAILABLE",
    );
  }
});
it("requires the actual newer cancelled row and rereads session and native rights without promising a refund", async () => {
  const intent = cancellationIntent(
    await readCancellation(scope, personId, resId, sessionId),
    "Synthetic reason",
  );
  row.state = "cancelled";
  row.version = 3;
  const result = await readCancellationResult(intent, resId);
  expect(result.rights[0]!.available).toBe(7);
  expect(result.rights[0]!.consumed).toBe(1);
  expect(call.mock.calls.some((x) => x[0] === "session_get_v1")).toBe(true);
  row.version = 2;
  await expect(readCancellationResult(intent, resId)).rejects.toThrow(
    "PROFILE_CANCELLATION_RESULT_UNAVAILABLE",
  );
  await expect(readCancellationResult(intent, id(99))).rejects.toThrow(
    "PROFILE_CANCELLATION_RESULT_UNAVAILABLE",
  );
});
