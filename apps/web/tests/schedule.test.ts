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
