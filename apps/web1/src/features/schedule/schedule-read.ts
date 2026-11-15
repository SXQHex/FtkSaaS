import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import type {
  CalendarItem,
  Interval,
  ResourceRef,
  SessionView,
} from "../../lib/api-contracts/generated";
import { readClosureContext } from "../studio/closure";
import { readStudioResources } from "../studio/studio";
import { readStudioInstructors } from "../studio/studio-reads";

export async function readScheduleSources(scope: ClientScope) {
  const [context, resources, instructors] = await Promise.all([
    readClosureContext(scope),
    readStudioResources(scope),
    readStudioInstructors(scope),
  ]);
  return { scope: { ...scope }, center: context.center, resources, instructors };
}
export async function scheduleLocalDate(instant: string, timezone: string) {
  const temporal = await getTemporal();
  return temporal.Instant.from(instant).toZonedDateTimeISO(timezone).toPlainDate().toString();
}
function sessionIdentity(session: SessionView, id: string) {
  if (
    session.id !== id ||
    !Number.isSafeInteger(session.version) ||
    session.version < 1 ||
    !["planned", "occurred", "cancelled"].includes(session.state) ||
    [session.capacity.total, session.capacity.held, session.capacity.remaining].some(
      (value) => !Number.isSafeInteger(value) || value < 0,
    )
  )
    throw new Error("SCHEDULE_SESSION_UNAVAILABLE");
  return session;
}
export async function readScheduleSession(scope: ClientScope, id: string) {
  const backend = await scopedBackend(scope);
  return sessionIdentity(
    await backend.call("session_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      session_id: id,
    }),
    id,
  );
}
export type ScheduleReadItem =
  | { type: "session"; item: CalendarItem; session: SessionView }
  | { type: "event"; item: CalendarItem };

// Exhaust only the visible UTC interval, never all people or session history.
// Both filters are native resource reads: intersect their complete result sets,
// rather than filtering one cursor page or inventing an unsupported selector.
export async function readScheduleRange(
  scope: ClientScope,
  interval: Interval,
  filters: { roomId?: string; instructorId?: string } = {},
): Promise<{
  entries: ScheduleReadItem[];
  reads: { resource: ResourceRef | null; asOf: string[] }[];
}> {
  const temporal = await getTemporal();
  const start = temporal.Instant.from(interval.starts_at),
    end = temporal.Instant.from(interval.ends_at);
  if (temporal.Instant.compare(start, end) >= 0) throw new Error("SCHEDULE_RANGE_INVALID");
  const backend = await scopedBackend(scope);
  async function calendar(resource: ResourceRef | null) {
    const items: CalendarItem[] = [],
      asOf: string[] = [];
    const seenIds = new Set<string>(),
      seenCursors = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await backend.call("calendar_get_v1", {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: scope.orgId,
        center_id: scope.centerId,
        interval: { ...interval },
        ...(resource ? { resource } : {}),
        page: { limit: 50, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
      });
      temporal.Instant.from(page.as_of);
      asOf.push(page.as_of);
      for (const item of page.items) {
        const itemStart = temporal.Instant.from(item.starts_at),
          itemEnd = temporal.Instant.from(item.ends_at);
        const key = `${item.type}:${item.id}`;
        if (
          !item.id ||
          item.center_id !== scope.centerId ||
          !["session", "event"].includes(item.type) ||
          seenIds.has(key) ||
          temporal.Instant.compare(itemStart, itemEnd) >= 0 ||
          temporal.Instant.compare(itemStart, end) >= 0 ||
          temporal.Instant.compare(itemEnd, start) <= 0
        )
          throw new Error("SCHEDULE_CALENDAR_UNAVAILABLE");
        seenIds.add(key);
        items.push(item);
      }
      cursor = page.next_cursor ?? undefined;
      if (cursor && seenCursors.has(cursor)) throw new Error("SCHEDULE_CURSOR_UNAVAILABLE");
      if (cursor) seenCursors.add(cursor);
    } while (cursor);
    return { items, resource, asOf };
  }
  const resources: (ResourceRef | null)[] = [
    ...(filters.roomId ? [{ kind: "room" as const, id: filters.roomId }] : []),
    ...(filters.instructorId ? [{ kind: "person" as const, id: filters.instructorId }] : []),
  ];
  const pages = await Promise.all((resources.length ? resources : [null]).map(calendar));
  const first = pages[0]!;
  const secondIds = pages[1]
    ? new Set(pages[1].items.map((item) => `${item.type}:${item.id}`))
    : undefined;
  const items = first.items.filter(
    (item) => !secondIds || secondIds.has(`${item.type}:${item.id}`),
  );
  const entries: ScheduleReadItem[] = [];
  // CalendarItem intentionally has no lifecycle state. Hydrate real sessions in
  // bounded batches instead of guessing planned state or current assignments.
  for (let index = 0; index < items.length; index += 4) {
    entries.push(
      ...(await Promise.all(
        items.slice(index, index + 4).map(async (item): Promise<ScheduleReadItem> => {
          if (item.type === "event") return { type: "event", item };
          const session = sessionIdentity(
            await backend.call("session_get_v1", {
              client_api_version: 1,
              request_id: uuidv7(),
              org_id: scope.orgId,
              center_id: scope.centerId,
              session_id: item.id,
            }),
            item.id,
          );
          if (
            !temporal.Instant.from(session.starts_at).equals(
              temporal.Instant.from(item.starts_at),
            ) ||
            !temporal.Instant.from(session.ends_at).equals(temporal.Instant.from(item.ends_at))
          )
            throw new Error("SCHEDULE_CALENDAR_CHANGED");
          return { type: "session", item, session };
        }),
      )),
    );
  }
  return { entries, reads: pages.map(({ resource, asOf }) => ({ resource, asOf })) };
}
