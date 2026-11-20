import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarItem, EarningView, SessionView } from "@ftksaas/api-contracts";
const mock = vi.hoisted(() => ({ call: vi.fn(), session: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call: mock.call }) }));
vi.mock("../schedule/schedule-read", () => ({ readScheduleSession: mock.session }));
import {
  instructorPeriod,
  instructorRoomLabel,
  instructorAssigned,
  readInstructorCalendar,
  readInstructorEarnings,
  readInstructorSession,
} from "./instructor-read";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const interval = { starts_at: "2026-11-15T21:00:00Z", ends_at: "2026-11-22T21:00:00Z" };
const session: SessionView = {
  id: id(4),
  class_id: null,
  discipline_id: id(5),
  format: "group",
  state: "planned",
  attendance_state: "open",
  version: 1,
  starts_at: "2026-11-16T10:00:00Z",
  ends_at: "2026-11-16T11:00:00Z",
  assignments: [{ person_id: id(6), duty: "instructor" }],
  capacity: {
    total: 10,
    held: 0,
    remaining: 10,
    category_held: null,
    category_remaining: null,
    room_capacity: 20,
  },
};
const calendar: CalendarItem = {
  id: session.id,
  type: "session",
  center_id: scope.centerId,
  title: "Sentetik ders",
  starts_at: session.starts_at,
  ends_at: session.ends_at,
};
beforeEach(() => vi.clearAllMocks());
describe("instructor bounded self reads", () => {
  it("uses IANA local week and month boundaries across a DST transition", async () => {
    const period = await instructorPeriod("America/New_York", "sunday", "2027-11-08T02:00:00Z");
    expect(period.today).toBe("2027-11-07");
    expect(period.interval).toEqual({
      starts_at: "2027-11-07T04:00:00Z",
      ends_at: "2027-11-14T05:00:00Z",
    });
    expect(period.month).toEqual({
      starts_at: "2027-11-01T04:00:00Z",
      ends_at: "2027-12-01T05:00:00Z",
    });
  });
  it("honors Monday and Sunday preferences rather than a browser locale default", async () => {
    expect(
      (await instructorPeriod("Europe/Istanbul", "monday", "2026-11-22T12:00:00Z")).start,
    ).toBe("2026-11-16");
    expect(
      (await instructorPeriod("Europe/Istanbul", "sunday", "2026-11-22T12:00:00Z")).start,
    ).toBe("2026-11-22");
  });
  it("does not treat a booking or inactive class assignment as instructor authority", () => {
    expect(instructorAssigned(session, id(6))).toBe(true);
    expect(instructorAssigned({ ...session, assignments: [] }, id(6))).toBe(false);
    expect(
      instructorAssigned(
        {
          ...session,
          assignments: [],
          class_assignments: [
            { id: id(7), person_id: id(6), duty: "instructor", state: "inactive", version: 1 },
          ],
        },
        id(6),
      ),
    ).toBe(false);
    expect(
      instructorAssigned(
        {
          ...session,
          assignments: [],
          class_assignments: [
            { id: id(7), person_id: id(6), duty: "instructor", state: "active", version: 1 },
          ],
        },
        id(6),
      ),
    ).toBe(true);
  });
  it("keeps the native self resource and range on every page and removes unrelated assignments", async () => {
    mock.call
      .mockResolvedValueOnce({ items: [calendar], next_cursor: "second" })
      .mockResolvedValueOnce({ items: [{ ...calendar, id: id(8) }], next_cursor: null });
    mock.session.mockResolvedValueOnce(session).mockResolvedValueOnce({
      ...session,
      id: id(8),
      assignments: [{ person_id: id(9), duty: "instructor" }],
    });
    const result = await readInstructorCalendar(scope, id(6), interval);
    expect(result.map((row) => row.session.id)).toEqual([id(4)]);
    expect(mock.call).toHaveBeenCalledTimes(2);
    expect(mock.session).toHaveBeenCalledWith(scope, id(4), true);
    for (const [operation, request] of mock.call.mock.calls) {
      expect(operation).toBe("calendar_get_v1");
      expect(request).toMatchObject({
        org_id: scope.orgId,
        center_id: scope.centerId,
        interval,
        include_room_labels: true,
        resource: { kind: "person", id: id(6) },
      });
    }
  });
  it("distinguishes omitted room labels, no assigned room, and multiple native names", () => {
    expect(instructorRoomLabel(session, "unknown", "unassigned")).toBe("unknown");
    expect(instructorRoomLabel({ ...session, room_labels: [] }, "unknown", "unassigned")).toBe(
      "unassigned",
    );
    expect(
      instructorRoomLabel(
        {
          ...session,
          room_labels: [
            { room_id: id(20), name: "Salon A" },
            { room_id: id(21), name: "Salon B" },
          ],
        },
        "unknown",
        "unassigned",
      ),
    ).toBe("Salon A · Salon B");
  });
  it("rejects repeated cursors and cross-center calendar rows", async () => {
    mock.call
      .mockResolvedValueOnce({ items: [], next_cursor: "loop" })
      .mockResolvedValueOnce({ items: [], next_cursor: "loop" });
    await expect(readInstructorCalendar(scope, id(6), interval)).rejects.toThrow(
      "INSTRUCTOR_CALENDAR_UNAVAILABLE",
    );
    mock.call.mockResolvedValueOnce({
      items: [{ ...calendar, center_id: id(99) }],
      next_cursor: null,
    });
    await expect(readInstructorCalendar(scope, id(6), interval)).rejects.toThrow(
      "INSTRUCTOR_CALENDAR_UNAVAILABLE",
    );
  });
  it("sums native corrections exactly per currency across the bounded monthly cursors", async () => {
    const earning: EarningView = {
      id: id(10),
      person_id: id(6),
      center_id: scope.centerId,
      session_id: session.id,
      event_assignment_id: null,
      amount_minor: "9007199254740993",
      paid_minor: "0",
      remaining_minor: "9007199254740993",
      currency: "TRY",
      direction: "add",
      previous_id: null,
      closure_id: null,
      created_at: "2026-11-16T10:00:00Z",
      version: 1,
      basis: { source: "agreement_fixed", currency: "TRY", quantity: 1, excluded_blocked: 0 },
    };
    mock.call
      .mockResolvedValueOnce({ items: [earning], next_cursor: "next" })
      .mockResolvedValueOnce({
        items: [
          { ...earning, id: id(11), amount_minor: "3", direction: "subtract" },
          { ...earning, id: id(12), amount_minor: "100", currency: "USD" },
        ],
        next_cursor: null,
      });
    await expect(readInstructorEarnings(scope, id(6), interval)).resolves.toEqual([
      { currency: "TRY", amount: "9007199254740990" },
      { currency: "USD", amount: "100" },
    ]);
    expect(mock.call).toHaveBeenCalledTimes(2);
  });
});

it("rejects an unassigned direct session before reading calendar, attendance or names", async () => {
  mock.session.mockResolvedValue({
    ...session,
    assignments: [{ person_id: id(99), duty: "instructor" }],
  });
  await expect(readInstructorSession(scope, id(6), ["instructor"], session.id)).rejects.toThrow(
    "INSTRUCTOR_SESSION_UNAVAILABLE",
  );
  expect(mock.call).not.toHaveBeenCalled();
});
