import { expect, test } from "vitest";
import { calendarInterval, dateInZone, addDays, weekStart } from "../src/lib/schedule";

test("center dates and intervals do not use the browser timezone", () => {
  expect(dateInZone(new Date("2026-10-28T22:30:00Z"), "Europe/Istanbul")).toBe("2026-10-29");
  expect(calendarInterval("2026-10-29", "day", "Europe/Istanbul")).toEqual({
    starts_at: "2026-10-28T21:00:00.000Z",
    ends_at: "2026-10-29T21:00:00.000Z",
  });
  expect(weekStart("2026-11-01")).toBe("2026-10-26");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
});
test("DST days use their real 23/25-hour interval and a week spans both offsets", () => {
  expect(calendarInterval("2026-03-29", "day", "Europe/Berlin")).toEqual({
    starts_at: "2026-03-28T23:00:00.000Z",
    ends_at: "2026-03-29T22:00:00.000Z",
  });
  expect(calendarInterval("2026-10-25", "day", "Europe/Berlin")).toEqual({
    starts_at: "2026-10-24T22:00:00.000Z",
    ends_at: "2026-10-25T23:00:00.000Z",
  });
  expect(calendarInterval("2026-10-25", "week", "Europe/Berlin")).toEqual({
    starts_at: "2026-10-18T22:00:00.000Z",
    ends_at: "2026-10-25T23:00:00.000Z",
  });
});
test("calendar projections retain native resources and session/event discipline scope", async () => {
  const { calendarEntry, matchesCalendarFilters } = await import("../src/lib/schedule");
  const entry = calendarEntry({
    id: "lesson",
    type: "session",
    center_id: "center",
    title: "Tango",
    starts_at: "2027-01-01T10:00:00Z",
    ends_at: "2027-01-01T11:00:00Z",
    discipline_id: "tango",
    resources: [
      { kind: "room", id: "r1" },
      { kind: "person", id: "i1" },
    ],
  });
  expect(
    matchesCalendarFilters(entry, { roomId: "r1", instructorId: "i1", disciplineId: "tango" }),
  ).toBe(true);
  expect(matchesCalendarFilters(entry, { roomId: "r2", instructorId: "i1" })).toBe(false);
  expect(matchesCalendarFilters(entry, { disciplineId: "salsa" })).toBe(false);
  const event = calendarEntry({
    id: "event",
    type: "event",
    center_id: "center",
    title: "Workshop",
    starts_at: entry.startsAt,
    ends_at: entry.endsAt,
    discipline_ids: ["tango", "salsa"],
  });
  expect(matchesCalendarFilters(event, { disciplineId: "salsa" })).toBe(true);
  expect(matchesCalendarFilters(event, { instructorId: "i1" })).toBe(false);
  expect(matchesCalendarFilters(event, {})).toBe(true);
});
