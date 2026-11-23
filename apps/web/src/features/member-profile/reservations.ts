import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { AttendanceEntryView, ReservationView, SessionView } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type { TFunction } from "i18next";
import type { ProfileReservation } from "./member-profile-view";

type Session = Pick<
  SessionView,
  | "id"
  | "discipline_id"
  | "format"
  | "starts_at"
  | "ends_at"
  | "state"
  | "attendance_state"
  | "version"
>;
export interface MemberReservation {
  reservation: ReservationView;
  session?: Session;
  attendance?: Pick<AttendanceEntryView, "result">;
  attendanceAvailable: boolean;
}
function accessLost(error: unknown) {
  return (
    (error instanceof BackendError && ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
    (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
  );
}
export async function readMemberReservations(
  scope: ClientScope,
  personId: string,
  cursor?: string,
  timeFilter: "all" | "upcoming" | "past" = "all",
  options: {
    sort?: "created_at_desc" | "starts_at_asc";
    includeSourceSummary?: boolean;
    sessionId?: string;
  } = {},
  readContext?: AccountReadContext,
) {
  z.uuid().parse(personId);
  if (options.sessionId) z.uuid().parse(options.sessionId);
  const backend = await scopedBackend(scope, undefined, readContext),
    common = { client_api_version: 1 as const, org_id: scope.orgId, center_id: scope.centerId };
  const page = await backend.call("reservation_list_v1", {
    ...common,
    request_id: uuidv7(),
    person_id: personId,
    ...(options.sessionId ? { session_id: options.sessionId } : {}),
    time_filter: timeFilter,
    ...(options.includeSourceSummary ? { include_source_summary: true } : {}),
    page: { limit: 20, sort: options.sort ?? "created_at_desc", ...(cursor ? { cursor } : {}) },
  });
  z.iso.datetime({ offset: true }).parse(page.as_of);
  if (page.items.length > 20 || (cursor && page.next_cursor === cursor))
    throw new Error("PROFILE_RESERVATIONS_UNAVAILABLE");
  const ids = new Set<string>();
  for (const row of page.items) {
    z.uuid().parse(row.id);
    z.uuid().parse(row.session_id);
    if (
      row.person_id !== personId ||
      (options.sessionId && row.session_id !== options.sessionId) ||
      ids.has(row.id)
    )
      throw new Error("PROFILE_RESERVATIONS_UNAVAILABLE");
    ids.add(row.id);
    z.enum(["active", "cancelled", "completed"]).parse(row.state);
    z.number().int().positive().safe().parse(row.version);
  }
  const sessions = new Map<string, { session?: Session; entries?: AttendanceEntryView[] }>();
  const sessionIds = [...new Set(page.items.map((x) => x.session_id))];
  // Only hydrate this visible cursor page. Keep the native order and bound concurrent reads.
  for (let i = 0; i < sessionIds.length; i += 4)
    await Promise.all(
      sessionIds.slice(i, i + 4).map(async (id) => {
        let native: SessionView;
        try {
          native = await backend.call("session_get_v1", {
            ...common,
            request_id: uuidv7(),
            session_id: id,
          });
        } catch (error) {
          if (accessLost(error)) throw error;
          if (!(error instanceof BackendError)) throw error;
          sessions.set(id, {});
          return;
        }
        if (native.id !== id || Date.parse(native.starts_at) >= Date.parse(native.ends_at))
          throw new Error("PROFILE_SESSION_UNAVAILABLE");
        z.iso.datetime({ offset: true }).parse(native.starts_at);
        z.iso.datetime({ offset: true }).parse(native.ends_at);
        z.number().int().positive().safe().parse(native.version);
        z.uuid().parse(native.discipline_id);
        z.enum(["group", "private"]).parse(native.format);
        z.enum(["planned", "occurred", "cancelled"]).parse(native.state);
        z.enum(["open", "closed"]).parse(native.attendance_state);
        const session: Session = {
          id: native.id,
          discipline_id: native.discipline_id,
          format: native.format,
          starts_at: native.starts_at,
          ends_at: native.ends_at,
          state: native.state,
          attendance_state: native.attendance_state,
          version: native.version,
        };
        // Do not retain participant/contact metadata from SessionView or another member's roster entries.
        let entries: AttendanceEntryView[] | undefined;
        try {
          const attendance = await backend.call("attendance_get_v1", {
            ...common,
            request_id: uuidv7(),
            session_id: id,
          });
          if (
            attendance.session_id !== id ||
            attendance.session_version !== session.version ||
            attendance.closure_state !== session.attendance_state
          )
            throw new Error("PROFILE_ATTENDANCE_CHANGED");
          entries = attendance.entries.filter(
            (x) =>
              x.person_id === personId &&
              page.items.some((r) => r.id === x.reservation_id && r.session_id === id),
          );
          for (const row of entries)
            z.enum(["unmarked", "attended", "no_show", "blocked"]).parse(row.result);
        } catch (error) {
          if (accessLost(error)) throw error;
          if (!(error instanceof BackendError)) throw error;
        }
        sessions.set(id, { session, entries });
      }),
    );
  const items: MemberReservation[] = page.items.map((reservation) => {
    const source = sessions.get(reservation.session_id),
      entries = source?.entries?.filter((x) => x.reservation_id === reservation.id) ?? [];
    if (entries.length > 1) throw new Error("PROFILE_ATTENDANCE_UNAVAILABLE");
    return {
      reservation,
      session: source?.session,
      attendance: entries[0] ? { result: entries[0].result } : undefined,
      attendanceAvailable: source?.entries !== undefined,
    };
  });
  return {
    items,
    nextCursor: page.next_cursor,
    asOf: page.as_of,
    partial: items.some((x) => !x.session || !x.attendanceAvailable),
  };
}
export function memberReservationRows(
  items: MemberReservation[],
  timezone: string,
  disciplines: { id: string; name: string }[],
  t: TFunction,
): ProfileReservation[] {
  const date = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  });
  return items.map(({ reservation, session, attendance, attendanceAvailable }) => ({
    id: reservation.id,
    lesson: session
      ? `${disciplines.find((x) => x.id === session.discipline_id)?.name ?? t(($) => $.products.disciplineScope)} · ${t(($) => $.schedule.formats[session.format])}`
      : t(($) => $.memberProfile.unknown),
    date: session
      ? `${date.format(new Date(session.starts_at))} – ${new Intl.DateTimeFormat("tr-TR", { timeStyle: "short", timeZone: timezone }).format(new Date(session.ends_at))}`
      : t(($) => $.memberProfile.unknown),
    reservation: t(($) => $.memberProfile.reservationStates[reservation.state]),
    attendance: !attendanceAvailable
      ? t(($) => $.memberProfile.unknown)
      : attendance
        ? session?.attendance_state !== "closed"
          ? t(($) => $.memberProfile.attendanceDraft, {
              result: t(($) => $.memberProfile.attendanceResults[attendance.result]),
            })
          : t(($) => $.memberProfile.attendanceResults[attendance.result])
        : t(($) => $.memberProfile.attendanceNoEntry),
    credit: t(($) => $.memberProfile.unknown),
  }));
}

export async function readProfileReservation(
  scope: ClientScope,
  personId: string,
  id: string,
  sessionId: string,
) {
  const backend = await scopedBackend(scope),
    cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await backend.call("reservation_list_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
      session_id: sessionId,
      page: { limit: 20, ...(cursor ? { cursor } : {}) },
    });
    if (page.items.some((row) => row.person_id !== personId || row.session_id !== sessionId))
      throw new Error("PROFILE_CANCELLATION_UNAVAILABLE");
    const matches = page.items.filter((row) => row.id === id);
    if (matches.length > 1) throw new Error("PROFILE_CANCELLATION_UNAVAILABLE");
    if (matches[0]) {
      z.number().int().positive().safe().parse(matches[0].version);
      return matches[0];
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw new Error("PROFILE_CANCELLATION_UNAVAILABLE");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  throw new Error("PROFILE_CANCELLATION_UNAVAILABLE");
}
