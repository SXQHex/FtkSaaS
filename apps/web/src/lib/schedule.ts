import type { CalendarItem, Interval } from "@ftksaas/api-contracts";

// Calendar providers consume this view model, never domain write commands.
export type CalendarEntry = {
  id: string;
  kind: "session" | "event";
  title: string;
  startsAt: string;
  endsAt: string;
  capacity?: { total: number; held: number; remaining: number };
};
export type CalendarRange = "day" | "week";
export const calendarEntry = (item: CalendarItem): CalendarEntry => ({
  id: item.id,
  kind: item.type,
  title: item.title,
  startsAt: item.starts_at,
  endsAt: item.ends_at,
  ...(item.capacity && "total" in item.capacity
    ? {
        capacity: {
          total: item.capacity.total,
          held: item.capacity.held,
          remaining: item.capacity.remaining,
        },
      }
    : {}),
});
export function dateInZone(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
export function weekStart(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -(weekday === 0 ? 6 : weekday - 1));
}
function midnight(date: string, timeZone: string) {
  const target = Date.parse(`${date}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let instant = target;
  for (let index = 0; index < 4; index++) {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (type: string) => Number(parts.find((value) => value.type === type)!.value);
    const projected = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second"),
    );
    if (projected === target) break;
    instant += target - projected;
  }
  return new Date(instant).toISOString();
}
export function calendarInterval(date: string, range: CalendarRange, timeZone: string): Interval {
  const start = range === "week" ? weekStart(date) : date;
  return {
    starts_at: midnight(start, timeZone),
    ends_at: midnight(addDays(start, range === "week" ? 7 : 1), timeZone),
  };
}
export function entryKey(entry: CalendarEntry) {
  return `${entry.kind}:${entry.id}`;
}
