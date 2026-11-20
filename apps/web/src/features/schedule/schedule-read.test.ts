import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarItem, SessionView } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import { readScheduleEditor, readScheduleRange, readScheduleReplacements } from "./schedule-read";

const scope = { accountId: "fixture-account", orgId: "fixture-org", centerId: "fixture-center" };
it("reads a durable replacement relation through its source selector and rejects a different source", async () => {
  const row = {
    exists: true,
    entity: { type: "sessions", id: "replacement" },
    state: "planned",
    versions: [{ entity: { type: "sessions", id: "replacement" }, version: 4 }],
    current: {
      operation: "replacement_session_create_v1",
      values: {
        replaces_id: "source",
        interval: { starts_at: "2026-11-18T10:00:00Z", ends_at: "2026-11-18T11:00:00Z" },
      },
    },
  };
  call.mockResolvedValueOnce({ items: [row], next_cursor: null });
  expect(await readScheduleReplacements(scope, "source")).toEqual([
    { id: "replacement", version: 4, state: "planned", interval: row.current.values.interval },
  ]);
  expect(call).toHaveBeenLastCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      operation: "replacement_session_create_v1",
      selector: { operation: "replacement_session_create_v1", key: { replaces_id: "source" } },
    }),
  );
  call.mockResolvedValueOnce({
    items: [
      {
        ...row,
        current: { ...row.current, values: { ...row.current.values, replaces_id: "other" } },
      },
    ],
    next_cursor: null,
  });
  await expect(readScheduleReplacements(scope, "source")).rejects.toThrow(
    "SCHEDULE_REPLACEMENT_UNAVAILABLE",
  );
});
it("accepts a real empty replacement page but rejects a repeated relationship cursor", async () => {
  call.mockResolvedValueOnce({ items: [], next_cursor: null });
  expect(await readScheduleReplacements(scope, "source")).toEqual([]);
  call.mockResolvedValue({ items: [], next_cursor: "again" });
  await expect(readScheduleReplacements(scope, "source")).rejects.toThrow(
    "SCHEDULE_CURSOR_UNAVAILABLE",
  );
});
const interval = { starts_at: "2026-11-15T00:00:00Z", ends_at: "2026-11-16T00:00:00Z" };
const item = (id: string, type: CalendarItem["type"] = "event"): CalendarItem => ({
  id,
  type,
  center_id: scope.centerId,
  title: "Synthetic lesson",
  starts_at: "2026-11-15T09:00:00Z",
  ends_at: "2026-11-15T10:00:00Z",
});
const session = (): SessionView => ({
  id: "fixture-session",
  class_id: null,
  discipline_id: "fixture-discipline",
  format: "group",
  starts_at: "2026-11-15T09:00:00Z",
  ends_at: "2026-11-15T10:00:00Z",
  state: "planned",
  attendance_state: "open",
  assignments: [],
  version: 3,
  capacity: {
    total: 12,
    held: 2,
    remaining: 10,
    category_held: null,
    category_remaining: null,
    room_capacity: null,
  },
});
const page = (items: CalendarItem[], next_cursor?: string) => ({
  items,
  next_cursor,
  as_of: "2026-11-15T08:00:00Z",
});
beforeEach(() => {
  call.mockReset();
});

describe("native visible calendar range", () => {
  it("intersects all pages of both native resource reads, including a match on the second pages", async () => {
    call.mockImplementation(async (_operation, request) => {
      expect(request.org_id).toBe(scope.orgId);
      expect(request.center_id).toBe(scope.centerId);
      expect(request.interval).toEqual(interval);
      const room = request.resource.kind === "room";
      return request.page.cursor
        ? page([item("shared")])
        : page([item(room ? "room-only" : "teacher-only")], room ? "room-next" : "teacher-next");
    });
    const result = await readScheduleRange(scope, interval, {
      roomId: "room",
      instructorId: "teacher",
    });
    expect(result.entries.map((entry) => entry.item.id)).toEqual(["shared"]);
    expect(result.reads.map((read) => read.asOf.length)).toEqual([2, 2]);
    expect(call).toHaveBeenCalledTimes(4);
  });

  it("rejects repeated pagination rather than looping or showing partial success", async () => {
    call.mockResolvedValue(page([], "repeated"));
    await expect(readScheduleRange(scope, interval)).rejects.toThrow("SCHEDULE_CURSOR_UNAVAILABLE");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it.each(["center", "outside", "duplicate"])("rejects a %s violation", async (failure) => {
    const row = item("one");
    if (failure === "center") row.center_id = "different-center";
    if (failure === "outside") {
      row.starts_at = interval.ends_at;
      row.ends_at = "2026-11-16T01:00:00Z";
    }
    call.mockResolvedValue(page(failure === "duplicate" ? [row, row] : [row]));
    await expect(readScheduleRange(scope, interval)).rejects.toThrow(
      "SCHEDULE_CALENDAR_UNAVAILABLE",
    );
  });

  it("rejects a session changed since the calendar read instead of mixing snapshots", async () => {
    call.mockImplementation(async (operation) =>
      operation === "calendar_get_v1"
        ? page([item("fixture-session", "session")])
        : { ...session(), starts_at: "2026-11-15T09:30:00Z" },
    );
    await expect(readScheduleRange(scope, interval)).rejects.toThrow("SCHEDULE_CALENDAR_CHANGED");
  });
});

describe("session detail and independent editor prerequisite", () => {
  it("keeps a readable session visible when native scheduling policy is missing, without inventing resources", async () => {
    call.mockImplementation(async (operation) => {
      if (operation === "session_get_v1") return session();
      throw new BackendError({
        code: "POLICY_NOT_CONFIGURED",
        retryable: false,
        trace_id: "synthetic-trace",
      });
    });
    await expect(readScheduleEditor(scope, "fixture-session")).resolves.toEqual({
      session: session(),
      resources: null,
    });
  });

  it("does not convert permission loss into a read-only fallback", async () => {
    call.mockImplementation(async (operation) => {
      if (operation === "session_get_v1") return session();
      throw new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: "synthetic-trace" });
    });
    await expect(readScheduleEditor(scope, "fixture-session")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects an absent management projection rather than treating it as an empty replacement list", async () => {
    call.mockImplementation(async (operation) =>
      operation === "session_get_v1" ? session() : { items: [] },
    );
    await expect(readScheduleEditor(scope, "fixture-session")).rejects.toThrow(
      "SCHEDULE_EDITOR_UNAVAILABLE",
    );
  });
});
