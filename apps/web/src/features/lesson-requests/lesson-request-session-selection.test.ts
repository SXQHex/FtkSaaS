import { beforeEach, expect, it, vi } from "vitest";
import type { CalendarItem, LessonRequestView, SessionView } from "@ftksaas/api-contracts";
import { readRequestSessions } from "./lesson-requests-read";

const mock = vi.hoisted(() => ({ call: vi.fn(), session: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call: mock.call }) }));
vi.mock("../schedule/schedule-read", () => ({ readScheduleSession: mock.session }));

const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const request: LessonRequestView = {
  id: id(4),
  version: 1,
  created_at: "2026-11-15T10:00:00Z",
  center_id: scope.centerId,
  person_id: id(5),
  format: "private",
  requested_start: "2026-11-16T10:00:00Z",
  duration_minutes: 60,
  preferred_instructor_id: id(6),
  state: "pending",
  discipline_id: id(7),
  alternatives: [],
};
const session: SessionView = {
  id: id(8),
  starts_at: request.requested_start,
  ends_at: "2026-11-16T11:00:00Z",
  discipline_id: request.discipline_id,
  class_id: null,
  format: "private",
  state: "planned",
  attendance_state: "open",
  version: 2,
  assignments: [{ person_id: id(6), duty: "instructor" }],
  capacity: {
    total: 1,
    held: 0,
    remaining: 1,
    category_held: null,
    category_remaining: null,
    room_capacity: 10,
  },
};
const item: CalendarItem = {
  id: session.id,
  type: "session",
  center_id: scope.centerId,
  starts_at: session.starts_at,
  ends_at: session.ends_at,
  title: "Fixture",
  discipline_id: session.discipline_id,
  capacity: session.capacity,
  session_summary: {
    class_id: session.class_id,
    format: session.format,
    state: session.state,
    attendance_state: session.attendance_state,
    version: session.version,
    assignments: session.assignments,
  },
};
beforeEach(() => {
  mock.call.mockReset();
  mock.session.mockReset().mockResolvedValue(session);
});

it("uses the scoped calendar projection and keeps exact readback on the native session reader", async () => {
  mock.call.mockResolvedValue({ items: [item], next_cursor: null });
  await expect(readRequestSessions(scope, request)).resolves.toMatchObject([session]);
  expect(mock.call).toHaveBeenCalledExactlyOnceWith(
    "calendar_get_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      include_session_summary: true,
    }),
  );
  expect(mock.session).not.toHaveBeenCalled();

  await expect(readRequestSessions(scope, request, undefined, session.id)).resolves.toEqual([
    session,
  ]);
  expect(mock.call).toHaveBeenCalledTimes(1);
  expect(mock.session).toHaveBeenCalledExactlyOnceWith(scope, session.id, undefined, undefined);
});

it("excludes a different center, discipline, instructor and closed session without extra reads", async () => {
  mock.call.mockResolvedValue({
    items: [
      { ...item, id: id(9), center_id: id(100) },
      { ...item, id: id(10), discipline_id: id(100) },
      { ...item, id: id(11), session_summary: { ...item.session_summary, assignments: [] } },
      {
        ...item,
        id: id(12),
        session_summary: { ...item.session_summary, attendance_state: "closed" },
      },
    ],
    next_cursor: null,
  });
  await expect(readRequestSessions(scope, request)).resolves.toEqual([]);
  expect(mock.session).not.toHaveBeenCalled();
});

it("resolves a missing summary with the exact session reader", async () => {
  mock.call.mockResolvedValue({ items: [{ ...item, session_summary: undefined }] });
  await expect(readRequestSessions(scope, request)).resolves.toEqual([session]);
  expect(mock.session).toHaveBeenCalledExactlyOnceWith(scope, session.id, undefined, undefined);
});
