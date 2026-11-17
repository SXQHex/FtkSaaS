import { beforeEach, expect, it, vi } from "vitest";
import type { SessionView, ReservationView } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import {
  overviewDay,
  readOverviewDay,
  readOverviewLabels,
  readOverviewParticipants,
  type OverviewSession,
} from "./overview-read";
const { range, instructors, participants, room } = vi.hoisted(() => ({
  range: vi.fn(),
  instructors: vi.fn(),
  participants: vi.fn(),
  room: vi.fn(),
}));
vi.mock("../schedule/schedule-read", () => ({ readScheduleRange: range }));
vi.mock("../session-detail/session-detail-read", () => ({
  readSessionInstructors: instructors,
  readSessionParticipants: participants,
}));
vi.mock("../studio/studio", () => ({ readStudioResource: room }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`,
  scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const session: SessionView = {
  id: id(4),
  class_id: null,
  discipline_id: id(5),
  format: "group",
  state: "planned",
  attendance_state: "open",
  starts_at: "2026-11-16T13:00:00Z",
  ends_at: "2026-11-16T14:00:00Z",
  assignments: [],
  version: 2,
  capacity: {
    total: 12,
    held: 4,
    remaining: 8,
    category_held: null,
    category_remaining: null,
    room_capacity: 20,
  },
};
const entry: OverviewSession = {
  type: "session",
  session,
  item: {
    id: session.id,
    type: "session",
    center_id: scope.centerId,
    title: "Sentetik ders",
    starts_at: session.starts_at,
    ends_at: session.ends_at,
    resources: [{ kind: "room", id: id(6) }],
  },
};
const row = (n: number, state: ReservationView["state"] = "active") => ({
  reservation: {
    id: id(n),
    session_id: session.id,
    person_id: id(7),
    state,
    mode: "flexible" as const,
    version: 1,
  },
  person: undefined,
});
beforeEach(() => {
  range.mockReset();
  instructors.mockReset();
  participants.mockReset();
  room.mockReset();
});
it("uses center-local day boundaries through 23/25-hour DST days", async () => {
  expect((await overviewDay("America/New_York", "2026-03-08T12:00:00Z")).interval).toEqual({
    starts_at: "2026-03-08T05:00:00Z",
    ends_at: "2026-03-09T04:00:00Z",
  });
  expect((await overviewDay("America/New_York", "2026-11-01T12:00:00Z")).interval).toEqual({
    starts_at: "2026-11-01T04:00:00Z",
    ends_at: "2026-11-02T05:00:00Z",
  });
});
it("reads one local day and preserves native lifecycle instead of completing past planned sessions", async () => {
  const past = {
    ...entry,
    item: {
      ...entry.item,
      id: id(8),
      starts_at: "2026-11-16T10:00:00Z",
      ends_at: "2026-11-16T11:00:00Z",
    },
    session: {
      ...session,
      id: id(8),
      starts_at: "2026-11-16T10:00:00Z",
      ends_at: "2026-11-16T11:00:00Z",
    },
  };
  range.mockResolvedValue({ entries: [entry, past], reads: [] });
  const result = await readOverviewDay(scope, "Europe/Istanbul", "2026-11-16T12:00:00Z");
  expect(result.sessions.map((r) => r.session.id)).toEqual([id(8), session.id]);
  expect(result.sessions[0]?.session.state).toBe("planned");
  expect(result.nextId).toBe(session.id);
  expect(range).toHaveBeenCalledWith(scope, {
    starts_at: "2026-11-15T21:00:00Z",
    ends_at: "2026-11-16T21:00:00Z",
  });
});
it("uses safe assigned room labels and refuses a different session version", async () => {
  instructors.mockResolvedValue({
    session: { ...session, room_labels: [{ room_id: id(6), name: "Atanmış salon" }] },
    instructors: [],
  });
  expect((await readOverviewLabels(scope, [entry])).get(session.id)?.rooms).toEqual([
    "Atanmış salon",
  ]);
  expect(room).not.toHaveBeenCalled();
  expect(instructors).toHaveBeenCalledWith(scope, session.id, true);
  instructors.mockResolvedValue({ session: { ...session, version: 3 }, instructors: [] });
  await expect(readOverviewLabels(scope, [entry])).rejects.toThrow("OVERVIEW_SESSION_CHANGED");
});
it("restricted room labels stay unknown while transport failure remains an error", async () => {
  instructors.mockResolvedValue({ session, instructors: [] });
  room.mockRejectedValue(
    new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: id(10) }),
  );
  expect((await readOverviewLabels(scope, [entry])).get(session.id)).toEqual({
    instructors: [],
    rooms: [],
  });
  room.mockRejectedValue(new BackendError());
  await expect(readOverviewLabels(scope, [entry])).rejects.toThrow();
});
it("previews at most three native registered members, following only the selected session cursor", async () => {
  participants
    .mockResolvedValueOnce({ items: [row(20, "cancelled")], next_cursor: "next" })
    .mockResolvedValueOnce({
      items: [row(21), row(22), row(23), row(24)],
      next_cursor: "unneeded",
    });
  const result = await readOverviewParticipants(scope, session.id);
  expect(result.map((r) => r.reservation.id)).toEqual([id(21), id(22), id(23)]);
  expect(participants).toHaveBeenCalledTimes(2);
  expect(participants).toHaveBeenLastCalledWith(scope, session.id, undefined, "next");
});
it("rejects repeated native reservation evidence across preview pages", async () => {
  participants
    .mockResolvedValueOnce({ items: [row(21)], next_cursor: "next" })
    .mockResolvedValueOnce({ items: [row(21)], next_cursor: null });
  await expect(readOverviewParticipants(scope, session.id)).rejects.toThrow(
    "OVERVIEW_PARTICIPANTS_UNAVAILABLE",
  );
});
