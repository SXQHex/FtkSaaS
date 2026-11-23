import { beforeEach, expect, it, vi } from "vitest";
import type { SessionView, AttendanceView, ReservationView } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
import { i18n } from "../../i18n";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import { readMemberReservations, memberReservationRows } from "./reservations";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(2), orgId: id(3), centerId: id(4) },
  personId = id(6);
const row = (n = 20): ReservationView => ({
  id: id(n),
  session_id: id(30),
  person_id: personId,
  state: "completed",
  mode: "flexible",
  version: 2,
});
const session = (): SessionView => ({
  id: id(30),
  class_id: null,
  discipline_id: id(9),
  format: "group",
  starts_at: "2026-11-16T10:00:00Z",
  ends_at: "2026-11-16T11:00:00Z",
  state: "occurred",
  attendance_state: "closed",
  assignments: [],
  capacity: {
    total: 8,
    held: 1,
    remaining: 7,
    category_held: null,
    category_remaining: null,
    room_capacity: null,
  },
  version: 4,
  shared_participants: [
    { person_id: id(99), display_name: "Other member synthetic", email: "other@example.invalid" },
  ],
});
const entry = (person = personId): AttendanceView["entries"][number] => ({
  reservation_id: id(20),
  person_id: person,
  result: person === personId ? "attended" : "blocked",
  version: 1,
  protected: false,
  eligibility_snapshot: null,
});
const attendance = (): AttendanceView => ({
  session_id: id(30),
  session_version: 4,
  closure_state: "closed",
  revision: 1,
  entries: [entry(), entry(id(99))],
});
let rows: ReservationView[], nativeSession: SessionView, nativeAttendance: AttendanceView;
beforeEach(() => {
  call.mockReset();
  rows = [row()];
  nativeSession = session();
  nativeAttendance = attendance();
  call.mockImplementation(async (op) => {
    if (op === "reservation_list_v1")
      return { items: rows, next_cursor: "native-next", as_of: "2026-11-16T13:00:00+03:00" };
    if (op === "session_get_v1") return nativeSession;
    if (op === "attendance_get_v1") return nativeAttendance;
    throw new Error("UNEXPECTED_READ");
  });
});
it("reads only the requested native cursor page and discards other members and session contact metadata", async () => {
  rows = [row(), { ...row(21), state: "cancelled" }];
  const result = await readMemberReservations(scope, personId, "native-current");
  expect(call.mock.calls[0]).toEqual([
    "reservation_list_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
      page: { limit: 20, sort: "created_at_desc", cursor: "native-current" },
    }),
  ]);
  expect(call.mock.calls.filter((x) => x[0] === "reservation_list_v1")).toHaveLength(1);
  expect(call.mock.calls.filter((x) => x[0] === "session_get_v1")).toHaveLength(1);
  expect(call.mock.calls.filter((x) => x[0] === "attendance_get_v1")).toHaveLength(1);
  expect(result.items[0]!.attendance).toEqual({ result: "attended" });
  expect(result.items[1]!.attendance).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain("Other member");
  expect(JSON.stringify(result)).not.toContain("other@example.invalid");
  expect(result.nextCursor).toBe("native-next");
  expect(result.partial).toBe(false);
});
it.each(["all", "upcoming", "past"] as const)(
  "delegates %s to the native reader without filtering the returned cursor page",
  async (filter) => {
    // This lesson overlaps the server cutoff. The frontend must retain the
    // backend's partition decision instead of using its own clock or end time.
    nativeSession.starts_at = "2026-11-16T09:45:00Z";
    nativeSession.ends_at = "2026-11-16T11:00:00Z";
    const result = await readMemberReservations(scope, personId, "native-current", filter);
    expect(call.mock.calls[0]).toEqual([
      "reservation_list_v1",
      expect.objectContaining({
        time_filter: filter,
        person_id: personId,
        page: { limit: 20, sort: "created_at_desc", cursor: "native-current" },
      }),
    ]);
    expect(call.mock.calls[0]![1]).not.toHaveProperty("interval");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.reservation.id).toBe(id(20));
    expect(result.asOf).toBe("2026-11-16T13:00:00+03:00");
    expect(result.nextCursor).toBe("native-next");
  },
);
it("rejects a foreign person, repeated reservation identity, session identity or changed attendance snapshot", async () => {
  rows = [{ ...row(), person_id: id(90) }];
  await expect(readMemberReservations(scope, personId)).rejects.toThrow(
    "PROFILE_RESERVATIONS_UNAVAILABLE",
  );
  rows = [row(), row()];
  await expect(readMemberReservations(scope, personId)).rejects.toThrow(
    "PROFILE_RESERVATIONS_UNAVAILABLE",
  );
  rows = [row()];
  nativeSession.id = id(90);
  await expect(readMemberReservations(scope, personId)).rejects.toThrow(
    "PROFILE_SESSION_UNAVAILABLE",
  );
  nativeSession = session();
  nativeAttendance.closure_state = "open";
  await expect(readMemberReservations(scope, personId)).rejects.toThrow(
    "PROFILE_ATTENDANCE_CHANGED",
  );
  nativeAttendance = attendance();
  nativeAttendance.session_version = 5;
  await expect(readMemberReservations(scope, personId)).rejects.toThrow(
    "PROFILE_ATTENDANCE_CHANGED",
  );
});
it("keeps denied attendance unknown without turning the whole member page into empty success", async () => {
  const original = call.getMockImplementation()!;
  call.mockImplementation(async (op) => {
    if (op === "attendance_get_v1")
      throw new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: id(80) });
    return original(op);
  });
  const result = await readMemberReservations(scope, personId);
  expect(result.partial).toBe(true);
  expect(result.items[0]!.session?.id).toBe(id(30));
  expect(result.items[0]!.attendanceAvailable).toBe(false);
  const view = memberReservationRows(
    result.items,
    "Europe/Istanbul",
    [{ id: id(9), name: "Tango" }],
    i18n.t,
  );
  expect(view[0]!.attendance).toBe("—");
  expect(view[0]!.lesson).toBe("Tango · Grup dersi");
  expect(view[0]!.date).toContain("13:00");
  expect(view[0]!.credit).toBe("—");
});
it("propagates session revocation instead of treating it as a missing attendance row", async () => {
  call.mockImplementation(async (op) => {
    if (op === "reservation_list_v1")
      return { items: rows, next_cursor: null, as_of: "2026-11-16T10:00:00Z" };
    throw new BackendError({ code: "SESSION_REVOKED", retryable: false, trace_id: id(80) });
  });
  await expect(readMemberReservations(scope, personId)).rejects.toMatchObject({
    code: "SESSION_REVOKED",
  });
});
it("rejects a repeated native cursor and does not read or filter all history", async () => {
  call.mockResolvedValueOnce({
    items: [row()],
    next_cursor: "repeat",
    as_of: "2026-11-16T10:00:00Z",
  });
  await expect(readMemberReservations(scope, personId, "repeat")).rejects.toThrow(
    "PROFILE_RESERVATIONS_UNAVAILABLE",
  );
  expect(call).toHaveBeenCalledTimes(1);
});
it("labels an open attendance result as draft and distinguishes actual empty attendance", async () => {
  nativeSession.attendance_state = "open";
  nativeAttendance.closure_state = "open";
  let result = await readMemberReservations(scope, personId);
  expect(memberReservationRows(result.items, "Europe/Istanbul", [], i18n.t)[0]!.attendance).toBe(
    "Taslak · Geldi",
  );
  nativeAttendance.entries = [];
  result = await readMemberReservations(scope, personId);
  expect(memberReservationRows(result.items, "Europe/Istanbul", [], i18n.t)[0]!.attendance).toBe(
    "Yoklama kaydı yok",
  );
});
it("uses server lesson order and the same opted-in source summary on continuation pages", async () => {
  const result = await readMemberReservations(scope, personId, "own-second", "upcoming", {
    sort: "starts_at_asc",
    includeSourceSummary: true,
  });
  expect(call.mock.calls[0]).toEqual([
    "reservation_list_v1",
    expect.objectContaining({
      person_id: personId,
      center_id: scope.centerId,
      time_filter: "upcoming",
      include_source_summary: true,
      page: { limit: 20, sort: "starts_at_asc", cursor: "own-second" },
    }),
  ]);
  expect(result.nextCursor).toBe("native-next");
  expect(JSON.stringify(result)).not.toContain("other@example.invalid");
});

it("omits attendance when upcoming reservations have no attendance consumer", async () => {
  const result = await readMemberReservations(scope, personId, undefined, "upcoming", {
    includeAttendance: false,
  });
  expect(call.mock.calls.map(([operation]) => operation)).toEqual([
    "reservation_list_v1",
    "session_get_v1",
  ]);
  expect(result.items[0]!.session?.id).toBe(nativeSession.id);
  expect(result.partial).toBe(false);
});
