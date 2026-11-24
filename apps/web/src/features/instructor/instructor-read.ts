import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { ClientScope, AccountReadContext } from "../../lib/scoped-backend";
import { scopedBackend } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { getTemporal } from "../../lib/temporal";
import type { CalendarItem, Interval, SessionView } from "@ftksaas/api-contracts";
import { calendarSessionWithDiscipline } from "../schedule/calendar-session";
import { readScheduleSession } from "../schedule/schedule-read";
import { readSessionAttendance } from "../session-detail/session-detail-read";

export async function instructorPeriod(
  timezone: string,
  weekStart: "monday" | "sunday",
  now: string,
  offset = 0,
) {
  const T = await getTemporal();
  const local = T.Instant.from(now).toZonedDateTimeISO(timezone);
  const today = local.toPlainDate();
  const distance = weekStart === "sunday" ? today.dayOfWeek % 7 : today.dayOfWeek - 1;
  const start = today.subtract({ days: distance }).add({ weeks: offset });
  const month = today.with({ day: 1 });
  const instant = (date: typeof today) => date.toZonedDateTime(timezone).toInstant().toString();
  return {
    now,
    timezone,
    today: today.toString(),
    start: start.toString(),
    interval: { starts_at: instant(start), ends_at: instant(start.add({ weeks: 1 })) },
    month: { starts_at: instant(month), ends_at: instant(month.add({ months: 1 })) },
  };
}
export function instructorAssigned(session: SessionView, personId: string) {
  return (
    session.assignments.some((row) => row.person_id === personId && row.duty === "instructor") ||
    Boolean(
      session.class_assignments?.some(
        (row) => row.person_id === personId && row.duty === "instructor" && row.state === "active",
      ),
    )
  );
}
export function instructorRoomLabel(session: SessionView, unknown: string, unassigned: string) {
  return session.room_labels === undefined
    ? unknown
    : session.room_labels.map((room) => room.name).join(" · ") || unassigned;
}
export type InstructorCalendar = Awaited<ReturnType<typeof readInstructorCalendar>>;
export async function readInstructorCalendar(
  scope: ClientScope,
  personId: string,
  interval: Interval,
  readContext?: AccountReadContext,
) {
  z.uuid().parse(personId);
  const backend = await scopedBackend(scope, undefined, readContext),
    seen = new Set<string>(),
    ids = new Set<string>();
  const calendar: CalendarItem[] = [];
  let cursor: string | undefined;
  do {
    const page = await backend.call("calendar_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      interval,
      resource: { kind: "person", id: personId },
      include_room_labels: true,
      include_session_summary: true,
      page: { limit: 50, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
    });
    if (page.items.length > 50) throw new Error("INSTRUCTOR_CALENDAR_UNAVAILABLE");
    for (const item of page.items) {
      if (
        item.center_id !== scope.centerId ||
        ids.has(item.id) ||
        !Number.isFinite(Date.parse(item.starts_at)) ||
        !Number.isFinite(Date.parse(item.ends_at)) ||
        Date.parse(item.ends_at) <= Date.parse(item.starts_at) ||
        Date.parse(item.starts_at) >= Date.parse(interval.ends_at) ||
        Date.parse(item.ends_at) <= Date.parse(interval.starts_at)
      )
        throw new Error("INSTRUCTOR_CALENDAR_UNAVAILABLE");
      ids.add(z.uuid().parse(item.id));
      if (item.type === "session") calendar.push(item);
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw new Error("INSTRUCTOR_CALENDAR_UNAVAILABLE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  const items: { item: CalendarItem; session: SessionView }[] = [];
  for (let i = 0; i < calendar.length; i += 4) {
    const entries = await Promise.all(
      calendar.slice(i, i + 4).map(async (item) => {
        const projected = calendarSessionWithDiscipline(item);
        if (projected?.room_labels !== undefined && instructorAssigned(projected, personId))
          return { item, session: projected };
        const session = await readScheduleSession(
          scope,
          item.id,
          true,
          ...(readContext ? ([readContext] as const) : []),
        );
        if (
          Date.parse(session.starts_at) !== Date.parse(item.starts_at) ||
          Date.parse(session.ends_at) !== Date.parse(item.ends_at)
        )
          throw new Error("INSTRUCTOR_CALENDAR_UNAVAILABLE");
        return { item, session };
      }),
    );
    // A person resource can also match a booking; it never grants an instructor assignment.
    items.push(...entries.filter(({ session }) => instructorAssigned(session, personId)));
  }
  return items.sort(
    (a, b) =>
      Date.parse(a.session.starts_at) - Date.parse(b.session.starts_at) ||
      a.session.id.localeCompare(b.session.id),
  );
}
export function instructorReadStatus(error: unknown) {
  if (error instanceof BackendError && ["FORBIDDEN", "NOT_FOUND"].includes(error.code))
    return "restricted" as const;
  if (error instanceof BackendError && error.code === "PLAN_FEATURE_UNAVAILABLE")
    return "not_enabled" as const;
  throw error;
}
export async function readInstructorAttendance(
  scope: ClientScope,
  session: SessionView,
  readContext?: AccountReadContext,
) {
  try {
    const attendance = await readSessionAttendance(
      scope,
      session.id,
      ...(readContext ? ([readContext] as const) : []),
    );
    if (
      attendance.session_version !== session.version ||
      attendance.closure_state !== session.attendance_state
    )
      throw new Error("INSTRUCTOR_SESSION_CHANGED");
    return { status: "available" as const, attendance };
  } catch (error) {
    return { status: instructorReadStatus(error) };
  }
}
const earningPeriodTotals = z.array(
  z.object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    net_minor: z.string().regex(/^(0|-?[1-9][0-9]*)$/),
  }),
);

export async function readInstructorEarnings(
  scope: ClientScope,
  personId: string,
  interval: Interval,
  readContext?: AccountReadContext,
) {
  z.uuid().parse(personId);
  const time = z.iso.datetime({ offset: true });
  if (Date.parse(time.parse(interval.starts_at)) >= Date.parse(time.parse(interval.ends_at)))
    throw Error("INSTRUCTOR_EARNINGS_UNAVAILABLE");
  const backend = await scopedBackend(scope, undefined, readContext);
  const page = await backend.call("earnings_list_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: personId,
    interval,
    summary_only: true,
    page: { limit: 1 },
  });
  if (page.items.length || page.next_cursor) throw Error("INSTRUCTOR_EARNINGS_UNAVAILABLE");
  time.parse(page.as_of);
  const totals = earningPeriodTotals.parse(page.period_totals);
  if (new Set(totals.map((row) => row.currency)).size !== totals.length)
    throw Error("INSTRUCTOR_EARNINGS_UNAVAILABLE");
  return totals
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map((row) => ({ currency: row.currency, amount: row.net_minor }));
}

export async function readInstructorSession(
  scope: ClientScope,
  personId: string,
  duties: ("instructor" | "assistant")[],
  sessionId: string,
  readContext?: AccountReadContext,
) {
  z.uuid().parse(sessionId);
  z.uuid().parse(personId);
  const session = await readScheduleSession(
    scope,
    sessionId,
    true,
    ...(readContext ? ([readContext] as const) : []),
  );
  const assigned =
    session.assignments.some((row) => row.person_id === personId && duties.includes(row.duty)) ||
    Boolean(
      session.class_assignments?.some(
        (row) => row.person_id === personId && duties.includes(row.duty) && row.state === "active",
      ),
    );
  if (!assigned) throw new Error("INSTRUCTOR_SESSION_UNAVAILABLE");
  const backend = await scopedBackend(scope, undefined, readContext);
  const headerPage = await backend.call("calendar_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    interval: { starts_at: session.starts_at, ends_at: session.ends_at },
    resource: { kind: "person", id: personId },
    include_room_labels: true,
    page: { limit: 50, sort: "starts_at_asc" },
  });
  // The exact session header can lie past another overlap's first cursor page.
  const headers = [...headerPage.items];
  const cursors = new Set<string>();
  let cursor = headerPage.next_cursor ?? undefined;
  while (cursor) {
    if (cursors.has(cursor)) throw new Error("INSTRUCTOR_SESSION_UNAVAILABLE");
    cursors.add(cursor);
    const page = await backend.call("calendar_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      interval: { starts_at: session.starts_at, ends_at: session.ends_at },
      resource: { kind: "person", id: personId },
      include_room_labels: true,
      page: { limit: 50, sort: "starts_at_asc", cursor },
    });
    headers.push(...page.items);
    cursor = page.next_cursor ?? undefined;
  }
  const matches = headers.filter((row) => row.type === "session" && row.id === sessionId);
  if (
    matches.length !== 1 ||
    matches[0]!.center_id !== scope.centerId ||
    Date.parse(matches[0]!.starts_at) !== Date.parse(session.starts_at) ||
    Date.parse(matches[0]!.ends_at) !== Date.parse(session.ends_at)
  )
    throw new Error("INSTRUCTOR_SESSION_UNAVAILABLE");
  const attendance = await readInstructorAttendance(
    scope,
    session,
    ...(readContext ? ([readContext] as const) : []),
  );
  const ids = [
    ...new Set([
      personId,
      ...session.assignments.filter((row) => row.duty === "instructor").map((row) => row.person_id),
      ...(attendance.status === "available"
        ? attendance.attendance.entries.map((row) => row.person_id)
        : []),
    ]),
  ];
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 4)
    await Promise.all(
      ids.slice(i, i + 4).map(async (id) => {
        try {
          const person = await backend.call("person_get_v1", {
            client_api_version: 1,
            request_id: uuidv7(),
            org_id: scope.orgId,
            center_id: scope.centerId,
            person_id: id,
          });
          if (person.id !== id || !person.display_name)
            throw new Error("INSTRUCTOR_PERSON_UNAVAILABLE");
          names.set(id, person.display_name);
        } catch (error) {
          instructorReadStatus(error);
        }
      }),
    );
  return { session, header: matches[0]!, attendance, names };
}
