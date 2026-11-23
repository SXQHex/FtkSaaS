import { beforeEach, expect, it, vi } from "vitest";
import type { AttendanceView, EntitlementView, SessionView } from "@ftksaas/api-contracts";
const { call, readSession, readRights, readReservation, readAttendance } = vi.hoisted(() => ({
  call: vi.fn(),
  readSession: vi.fn(),
  readRights: vi.fn(),
  readReservation: vi.fn(),
  readAttendance: vi.fn(),
}));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
vi.mock("../schedule/schedule-read", () => ({ readScheduleSession: readSession }));
vi.mock("../member-profile/profile-read", () => ({ readProfileRights: readRights }));
vi.mock("../member-profile/reservations", () => ({ readProfileReservation: readReservation }));
vi.mock("./session-detail-read", () => ({ readSessionAttendance: readAttendance }));
import {
  sessionBookingIntent,
  readSessionBookingReceipt,
  readSessionBookingResult,
  readBookingRights,
} from "./session-booking";
import {
  attendanceStartIntent,
  attendanceMarkIntent,
  attendanceCloseIntent,
  previewAttendanceCorrection,
  readSessionAttendanceReceipt,
  readSessionAttendanceResult,
} from "./session-attendance";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(2), orgId: id(3), centerId: id(4) };
const session: SessionView = {
  id: id(5),
  class_id: null,
  discipline_id: id(9),
  format: "group",
  starts_at: "2026-11-16T01:00:00Z",
  ends_at: "2026-11-16T02:00:00Z",
  state: "planned",
  attendance_state: "open",
  assignments: [{ person_id: id(10), duty: "instructor" }],
  version: 3,
  capacity: {
    total: 12,
    held: 1,
    remaining: 11,
    category_held: null,
    category_remaining: null,
    room_capacity: 20,
  },
};
const attendance: AttendanceView = {
  session_id: id(5),
  session_version: 3,
  closure_state: "open",
  revision: 0,
  actual_started_at: "2026-11-16T01:00:00Z",
  entries: [
    {
      reservation_id: id(6),
      person_id: id(7),
      result: "unmarked",
      protected: false,
      version: 8,
      eligibility_snapshot: null,
    },
  ],
};

const sale: EntitlementView = {
  sale_id: id(8),
  person_id: id(7),
  start_date: "2026-11-01",
  end_date: "2026-12-01",
  timezone: "Europe/Istanbul",
  state: "active",
  booking_mode: "flexible",
  available: 8,
  reserved: 0,
  consumed: 0,
  deficit: 0,
  quotas: [],
  deficit_scopes: [],
};
const draft = () => ({
  query: "",
  personId: id(7),
  saleId: id(8),
  mode: "flexible" as const,
  category: "" as const,
  override: false,
  reason: "",
  reviewed: true,
});
beforeEach(() => vi.resetAllMocks());
it("pins an explicit eligible sale and keeps override a separate native authority/reasoned command", () => {
  const intent = sessionBookingIntent(scope, session.id, draft(), sale, false);
  expect(intent.operation).toBe("reservation_create_v1");
  expect(intent.request.source_sale_id).toBe(sale.sale_id);
  expect(intent.request).not.toHaveProperty("expected_version");
  expect(() =>
    sessionBookingIntent(
      scope,
      session.id,
      { ...draft(), override: true, reason: "explicit" },
      sale,
      false,
    ),
  ).toThrow("SESSION_BOOKING_OVERRIDE_UNAVAILABLE");
  expect(() =>
    sessionBookingIntent(scope, session.id, { ...draft(), reviewed: false }, sale, true),
  ).toThrow("SESSION_BOOKING_SOURCE_UNAVAILABLE");
  const override = sessionBookingIntent(
    scope,
    session.id,
    { ...draft(), override: true, reason: " explicit " },
    sale,
    true,
  );
  expect(override).toMatchObject({
    operation: "reservation_capacity_override_v1",
    request: { reason: "explicit", source_sale_id: sale.sale_id },
  });
});
it("reads session-aware rights and rejects a foreign person rather than offering an automatic sale", async () => {
  call.mockResolvedValueOnce([sale]);
  await readBookingRights(scope, id(7), id(5), "flexible");
  expect(call).toHaveBeenLastCalledWith(
    "entitlements_get_v1",
    expect.objectContaining({ person_id: id(7), session_id: id(5), booking_mode: "flexible" }),
  );
  call.mockResolvedValueOnce([{ ...sale, person_id: id(99) }]);
  await expect(readBookingRights(scope, id(7), id(5), "flexible")).rejects.toThrow(
    "SESSION_BOOKING_RIGHTS_UNAVAILABLE",
  );
});
it("recovers the exact acknowledged reservation, accepts a native category, and rejects another operation receipt", async () => {
  const intent = sessionBookingIntent(scope, session.id, draft(), sale, false);
  call.mockResolvedValueOnce({
    items: [
      {
        id: id(6),
        person_id: id(7),
        session_id: session.id,
        state: "active",
        mode: "flexible",
        booking_category: "female",
        version: 2,
        source_summary: { status: "available", source_sale_id: sale.sale_id },
      },
    ],
    next_cursor: null,
  });
  readSession.mockResolvedValue({ ...session, version: 4 });
  readRights.mockResolvedValue([sale]);
  expect((await readSessionBookingResult(intent, id(6))).reservation.id).toBe(id(6));
  expect(readRights).toHaveBeenCalledOnce();
  expect(call.mock.calls.every(([op]) => op !== "reservation_create_v1")).toBe(true);
  call.mockResolvedValueOnce({
    operation: "reservation_capacity_override_v1",
    key: intent.request.operation_key,
    status: "succeeded",
    result_reference: { type: "reservations", id: id(6) },
  });
  await expect(readSessionBookingReceipt(intent)).rejects.toThrow(
    "SESSION_BOOKING_RECEIPT_UNAVAILABLE",
  );
});
it("marks using the reservation version rather than the independent entry version", async () => {
  readReservation.mockResolvedValue({
    id: id(6),
    person_id: id(7),
    session_id: session.id,
    state: "active",
    version: 2,
  });
  const intent = await attendanceMarkIntent(scope, session, attendance, id(6), "attended");
  expect(intent).toMatchObject({
    operation: "attendance_mark_v1",
    request: { reservation_id: id(6), expected_version: 2, result: "attended" },
  });
  if (intent.operation !== "attendance_mark_v1") throw new Error("WRONG_ATTENDANCE_OPERATION");
  expect(intent.request.expected_version).not.toBe(attendance.entries[0]!.version);
});
it("requires a real start and an explicit valid performance roster for closure", () => {
  const marked: AttendanceView = {
    ...attendance,
    entries: attendance.entries.map((row) => ({ ...row, result: "attended" })),
  };
  expect(() =>
    attendanceCloseIntent(scope, session, { ...marked, actual_started_at: null }, true, [id(10)]),
  ).toThrow("SESSION_ATTENDANCE_SOURCE_CHANGED");
  expect(() => attendanceCloseIntent(scope, session, marked, true, [id(99)])).toThrow(
    "SESSION_ATTENDANCE_SOURCE_CHANGED",
  );
  expect(() => attendanceCloseIntent(scope, session, attendance, true, [id(10)])).toThrow(
    "SESSION_ATTENDANCE_SOURCE_CHANGED",
  );
  expect(attendanceCloseIntent(scope, session, marked, true, [id(10)])).toMatchObject({
    request: { expected_version: 3, performed: true, performed_instructor_ids: [id(10)] },
  });
  expect(() => attendanceStartIntent(scope, session, attendance, "reason")).toThrow(
    "SESSION_ATTENDANCE_SOURCE_CHANGED",
  );
});
it("rejects a correction preview bound to another session version", async () => {
  call.mockResolvedValueOnce({
    id: id(11),
    token: "synthetic",
    expires_at: "2099-01-01T00:00:00Z",
    blockers: [],
    effects: [],
    dependencies: {
      versions: [{ entity: { type: "sessions", id: session.id }, version: 99 }],
      policy_hashes: [],
      permission_hash: "synthetic",
    },
  });
  await expect(
    previewAttendanceCorrection(
      scope,
      { ...session, attendance_state: "closed" },
      { ...attendance, closure_state: "closed" },
      [{ reservation_id: id(6), result: "no_show" }],
      "explicit reason",
    ),
  ).rejects.toThrow("SESSION_ATTENDANCE_PREVIEW_UNAVAILABLE");
});
it("does not accept unchanged domain state or a receipt referencing another reservation after an attendance write", async () => {
  readReservation.mockResolvedValue({
    id: id(6),
    person_id: id(7),
    session_id: session.id,
    state: "active",
    version: 2,
  });
  const intent = await attendanceMarkIntent(scope, session, attendance, id(6), "attended");
  readSession.mockResolvedValue(session);
  readAttendance.mockResolvedValue(attendance);
  await expect(readSessionAttendanceResult(intent)).rejects.toThrow(
    "SESSION_ATTENDANCE_RESULT_UNAVAILABLE",
  );
  call.mockResolvedValueOnce({
    operation: "attendance_mark_v1",
    key: intent.request.operation_key,
    status: "succeeded",
    result_reference: { type: "reservations", id: id(99) },
  });
  await expect(readSessionAttendanceReceipt(intent)).rejects.toThrow(
    "SESSION_ATTENDANCE_RECEIPT_UNAVAILABLE",
  );
});

it("records an explicitly selected actual start instead of substituting browser now", () => {
  const chosen = "2026-11-16T00:55:00Z";
  const intent = attendanceStartIntent(
    scope,
    session,
    { ...attendance, actual_started_at: null },
    "Gerçek başlangıç düzeltmesi",
    chosen,
  );
  expect(intent.request).toMatchObject({
    actual_started_at: chosen,
    expected_version: session.version,
  });
});
it("instructor result recovery rereads native attendance without member rights readers", async () => {
  const intent = attendanceStartIntent(
    scope,
    session,
    { ...attendance, actual_started_at: null },
    "Başladı",
    attendance.actual_started_at!,
  );
  readSession.mockResolvedValue({ ...session, version: 4 });
  readAttendance.mockResolvedValue({ ...attendance, session_version: 4 });
  const result = await readSessionAttendanceResult(intent, false);
  expect(result.attendance.actual_started_at).toBe(attendance.actual_started_at);
  expect(result.affectedPeople).toBeUndefined();
  expect(readRights).not.toHaveBeenCalled();
});

it("identifies affected members after a verified instructor attendance closure", async () => {
  const before = {
    ...attendance,
    entries: attendance.entries.map((row) => ({ ...row, result: "attended" as const })),
  };
  const intent = attendanceCloseIntent(scope, session, before, true, [id(10)]);
  readSession.mockResolvedValue({ ...session, version: 4, attendance_state: "closed" });
  readAttendance.mockResolvedValue({
    ...before,
    session_version: 4,
    closure_state: "closed",
    revision: 1,
  });
  const result = await readSessionAttendanceResult(intent, false);
  expect(result.affectedPeople).toEqual([id(7)]);
  expect(readRights).not.toHaveBeenCalled();
});
