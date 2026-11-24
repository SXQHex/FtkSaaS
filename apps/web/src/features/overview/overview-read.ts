import type { ReservationView } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
import { getTemporal } from "../../lib/temporal";
import type { ClientScope, AccountReadContext } from "../../lib/scoped-backend";
import {
  readScheduleRange,
  readScheduleSession,
  type ScheduleReadItem,
} from "../schedule/schedule-read";
import {
  readSessionInstructors,
  readSessionParticipants,
} from "../session-detail/session-detail-read";
import { readStudioResource } from "../studio/studio";
export type OverviewSession = Extract<ScheduleReadItem, { type: "session" }>;
export async function overviewDay(timezone: string, now: string) {
  const T = await getTemporal(),
    local = T.Instant.from(now).toZonedDateTimeISO(timezone),
    start = local.startOfDay();
  return {
    interval: {
      starts_at: start.toInstant().toString(),
      ends_at: start.add({ days: 1 }).toInstant().toString(),
    },
    date: new Intl.DateTimeFormat("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: timezone,
    }).format(new Date(now)),
    now: new Intl.DateTimeFormat("tr-TR", { timeStyle: "short", timeZone: timezone }).format(
      new Date(now),
    ),
  };
}
export async function readOverviewDay(
  scope: ClientScope,
  timezone: string,
  now = new Date().toISOString(),
  context?: AccountReadContext,
) {
  const period = await overviewDay(timezone, now),
    result = await readScheduleRange(scope, period.interval, undefined, undefined, context, {
      managementLabels: true,
    });
  const sessions = result.entries
    .filter((r): r is OverviewSession => r.type === "session")
    .sort(
      (a, b) =>
        Date.parse(a.session.starts_at) - Date.parse(b.session.starts_at) ||
        a.session.id.localeCompare(b.session.id),
    );
  const next = sessions.find(
    (r) => r.session.state === "planned" && Date.parse(r.session.starts_at) >= Date.parse(now),
  );
  return { ...period, sessions, nextId: next?.session.id };
}
const hidden = (cause: unknown) =>
  cause instanceof BackendError &&
  ["FORBIDDEN", "NOT_FOUND", "PLAN_FEATURE_UNAVAILABLE"].includes(cause.code);
export async function readOverviewLabels(
  scope: ClientScope,
  sessions: OverviewSession[],
  context?: AccountReadContext,
) {
  const result = new Map<string, { instructors: string[]; rooms: string[] }>(),
    rooms = new Map<string, Promise<string | null>>();
  function roomName(id: string) {
    let value = rooms.get(id);
    if (!value) {
      value = readStudioResource(scope, "room", id, ...(context ? ([context] as const) : []))
        .then((row) => row.name)
        .catch((cause: unknown) => {
          if (hidden(cause)) return null;
          throw cause;
        });
      rooms.set(id, value);
    }
    return value;
  }
  for (let index = 0; index < sessions.length; index += 4)
    await Promise.all(
      sessions.slice(index, index + 4).map(async (before) => {
        const summary = before.item.session_summary;
        const labels = summary?.version === before.session.version ? summary : undefined;
        const instructors = labels?.instructor_labels?.map(({ name }) => name);
        if (instructors && labels?.room_labels) {
          result.set(before.session.id, {
            rooms: labels.room_labels.map(({ name }) => name),
            instructors,
          });
          return;
        }
        const fresh = instructors
          ? {
              session: await readScheduleSession(scope, before.session.id, true, context),
              instructors: [],
            }
          : await readSessionInstructors(
              scope,
              before.session.id,
              true,
              ...(context ? ([context] as const) : []),
            );
        if (fresh.session.version !== before.session.version)
          throw Error("OVERVIEW_SESSION_CHANGED");
        const nativeRooms = fresh.session.room_labels?.map((r) => r.name) ?? [];
        const names = nativeRooms.length
          ? nativeRooms
          : await Promise.all(
              (before.item.resources?.filter((r) => r.kind === "room") ?? []).map((r) =>
                roomName(r.id),
              ),
            );
        result.set(before.session.id, {
          instructors:
            instructors ??
            fresh.instructors.flatMap((r) => (r.person ? [r.person.display_name] : [])),
          rooms: names.filter((name): name is string => name !== null),
        });
      }),
    );
  return result;
}
export async function readOverviewParticipants(
  scope: ClientScope,
  sessionId: string,
  context?: AccountReadContext,
) {
  const rows: Awaited<ReturnType<typeof readSessionParticipants>>["items"] = [],
    cursors = new Set<string>(),
    seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await readSessionParticipants(
      scope,
      sessionId,
      undefined,
      cursor,
      context,
      (items) => {
        const preview: ReservationView[] = [];
        for (const row of items) {
          if (seen.has(row.id)) throw Error("OVERVIEW_PARTICIPANTS_UNAVAILABLE");
          seen.add(row.id);
          if (row.state === "active" || row.state === "completed") preview.push(row);
          if (rows.length + preview.length === 3) break;
        }
        return preview;
      },
    );
    rows.push(...page.items);
    if (rows.length === 3) return rows;
    cursor = page.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw Error("OVERVIEW_PARTICIPANTS_UNAVAILABLE");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return rows;
}
