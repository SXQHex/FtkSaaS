import { getTemporal } from "../../lib/temporal";
import type { Interval, LocalOffsetChoice } from "@ftksaas/api-contracts";
import type { ScheduleChoice } from "./schedule-view";

export interface ScheduleOffsetRequest {
  date: string;
  choices: ScheduleChoice[];
}
export class ScheduleTimeError extends Error {
  requests: ScheduleOffsetRequest[];
  constructor(
    message: "SCHEDULE_TIME_GAP" | "SCHEDULE_TIME_AMBIGUOUS",
    requests: ScheduleOffsetRequest[] = [],
  ) {
    super(message);
    this.requests = requests;
  }
}
export async function scheduleTimeChoices(timezone: string, date: string, time: string) {
  const temporal = await getTemporal();
  const local = temporal.PlainDate.from(date).toPlainDateTime(temporal.PlainTime.from(time));
  const fields = {
    timeZone: timezone,
    year: local.year,
    month: local.month,
    day: local.day,
    hour: local.hour,
    minute: local.minute,
    second: local.second,
    millisecond: local.millisecond,
    microsecond: local.microsecond,
    nanosecond: local.nanosecond,
  };
  const earlier = temporal.ZonedDateTime.from(fields, {
    disambiguation: "earlier",
    overflow: "reject",
  });
  const later = temporal.ZonedDateTime.from(fields, {
    disambiguation: "later",
    overflow: "reject",
  });
  if (!earlier.toPlainDateTime().equals(local) || !later.toPlainDateTime().equals(local))
    throw new ScheduleTimeError("SCHEDULE_TIME_GAP");
  return {
    local,
    earlier,
    later,
    offsets:
      earlier.epochNanoseconds === later.epochNanoseconds ? [] : [earlier.offset, later.offset],
  };
}
export async function scheduleInterval(
  timezone: string,
  date: string,
  time: string,
  durationMinutes: number,
  offset = "",
): Promise<Interval> {
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 1)
    throw new Error("SCHEDULE_INVALID");
  const temporal = await getTemporal();
  const { local, offsets } = await scheduleTimeChoices(timezone, date, time);
  if (offsets.length && !offsets.includes(offset))
    throw new ScheduleTimeError("SCHEDULE_TIME_AMBIGUOUS", [
      { date, choices: offsets.map((value) => ({ id: value, label: `UTC${value}` })) },
    ]);
  const start = temporal.ZonedDateTime.from(
    {
      timeZone: timezone,
      year: local.year,
      month: local.month,
      day: local.day,
      hour: local.hour,
      minute: local.minute,
      second: local.second,
      millisecond: local.millisecond,
      microsecond: local.microsecond,
      nanosecond: local.nanosecond,
      ...(offsets.length ? { offset } : {}),
    },
    { disambiguation: "reject", offset: "reject", overflow: "reject" },
  );
  return {
    starts_at: start.toInstant().toString(),
    ends_at: start.add({ minutes: durationMinutes }).toInstant().toString(),
  };
}

// Inspect IANA offset transitions, not a second recurrence/scheduling engine.
// The backend remains the only producer of actual program occurrences.
export async function programOffsetChoices(input: {
  timezone: string;
  startsOn: string;
  endsOn: string;
  time: string;
  weekdays: number[];
  selected: Record<string, string>;
}): Promise<LocalOffsetChoice[]> {
  const temporal = await getTemporal();
  const from = temporal.PlainDate.from(input.startsOn),
    until = temporal.PlainDate.from(input.endsOn);
  if (temporal.PlainDate.compare(from, until) >= 0) throw new Error("SCHEDULE_INVALID");
  const candidates = new Set<string>([from.toString()]);
  let cursor = from.toZonedDateTime(input.timezone).subtract({ nanoseconds: 1 });
  const end = until.toZonedDateTime(input.timezone);
  let transition = cursor.getTimeZoneTransition("next");
  while (transition && transition.epochNanoseconds < end.epochNanoseconds) {
    if (transition.epochNanoseconds <= cursor.epochNanoseconds)
      throw new Error("SCHEDULE_TIME_UNAVAILABLE");
    const before = transition.subtract({ nanoseconds: 1 }).toPlainDate(),
      after = transition.toPlainDate();
    let date = temporal.PlainDate.compare(before, after) < 0 ? before : after;
    const last = temporal.PlainDate.compare(before, after) < 0 ? after : before;
    while (temporal.PlainDate.compare(date, last) <= 0) {
      if (
        temporal.PlainDate.compare(date, from) >= 0 &&
        temporal.PlainDate.compare(date, until) < 0
      )
        candidates.add(date.toString());
      date = date.add({ days: 1 });
    }
    cursor = transition;
    transition = cursor.getTimeZoneTransition("next");
  }
  const requests: ScheduleOffsetRequest[] = [],
    choices: LocalOffsetChoice[] = [];
  for (const candidate of [...candidates].sort()) {
    const date = temporal.PlainDate.from(candidate);
    if (!input.weekdays.includes(date.dayOfWeek)) continue;
    const { offsets, earlier, later } = await scheduleTimeChoices(
      input.timezone,
      candidate,
      input.time,
    );
    if (!offsets.length) continue;
    const chosen = input.selected[candidate];
    if (!chosen || !offsets.includes(chosen)) {
      requests.push({
        date: candidate,
        choices: offsets.map((value) => ({ id: value, label: `UTC${value}` })),
      });
      continue;
    }
    const instant = earlier.offset === chosen ? earlier : later;
    const minutes = instant.offsetNanoseconds / 60_000_000_000;
    if (!Number.isSafeInteger(minutes)) throw new Error("SCHEDULE_OFFSET_UNAVAILABLE");
    choices.push({ date: candidate, offset_minutes: minutes });
  }
  if (requests.length) throw new ScheduleTimeError("SCHEDULE_TIME_AMBIGUOUS", requests);
  return choices;
}
