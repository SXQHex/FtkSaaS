import type { SessionPatch, SessionView } from "@ftksaas/api-contracts";
import { ApiFailure } from "./api";

export function localDateTime(instant: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const p = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}`;
}

// Resolve only real instants; daylight-saving gaps are never silently shifted.
export function localTimeChoices(value: string, timeZone: string) {
  const local = value.length === 16 ? `${value}:00` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(local)) return [];
  const wall = Date.parse(`${local}Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 19) !== local) return [];
  const offsets = new Set<number>();
  for (let hour = -36; hour <= 36; hour += 6) {
    const sample = wall + hour * 3600000;
    offsets.add(Date.parse(`${localDateTime(new Date(sample).toISOString(), timeZone)}Z`) - sample);
  }
  return [...offsets]
    .map((offset) => ({
      instant: new Date(wall - offset).toISOString(),
      offsetMinutes: offset / 60000,
    }))
    .filter(({ instant }) => localDateTime(instant, timeZone) === local)
    .sort((a, b) => a.instant.localeCompare(b.instant));
}

export function changePatch(
  session: SessionView,
  startsAt: string,
  endsAt: string,
  capacity: SessionPatch["capacity"],
): SessionPatch {
  const patch: SessionPatch = {};
  if (
    Date.parse(startsAt) !== Date.parse(session.starts_at) ||
    Date.parse(endsAt) !== Date.parse(session.ends_at)
  )
    patch.interval = { starts_at: startsAt, ends_at: endsAt };
  if (
    capacity &&
    (capacity.total !== session.capacity.total ||
      capacity.categories?.male !== session.capacity.categories?.male ||
      capacity.categories?.female !== session.capacity.categories?.female)
  )
    patch.capacity = capacity;
  return patch;
}

export function changeError(error: unknown) {
  return error instanceof ApiFailure ? error.failure.error.code : "network";
}
export function uncertainChange(error: unknown) {
  return (
    !(error instanceof ApiFailure) ||
    error.failure.error.retryable ||
    [
      "OPERATION_IN_PROGRESS",
      "OPERATION_RESULT_EXPIRED",
      "RESULT_NOT_CONFIRMED",
      "SERVICE_UNAVAILABLE",
      "TEMPORARY_FAILURE",
    ].includes(error.failure.error.code)
  );
}
