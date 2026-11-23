import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import { BackendError, queryBackendRead } from "../../lib/backend";
import type {
  CenterView,
  CalendarItem,
  Interval,
  ResourceRef,
  SessionView,
} from "@ftksaas/api-contracts";
import { readClosureContext } from "../studio/closure";
import { readStudioResources } from "../studio/studio";
import { readStudioInstructors } from "../studio/studio-reads";

export async function readScheduleSources(
  scope: ClientScope,
  readContext?: AccountReadContext,
  verifiedCenter?: CenterView,
) {
  const [center, resources, instructors] = await Promise.all([
    verifiedCenter ?? readClosureContext(scope, readContext).then((context) => context.center),
    readStudioResources(scope, readContext),
    readStudioInstructors(scope, undefined, readContext),
  ]);
  return { scope: { ...scope }, center, resources, instructors };
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
export async function readScheduleSession(
  scope: ClientScope,
  id: string,
  includeRoomLabels = false,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, readContext);
  return sessionIdentity(
    await queryBackendRead(
      backend,
      "session_get_v1",
      {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: scope.orgId,
        center_id: scope.centerId,
        session_id: id,
        ...(includeRoomLabels ? { include_room_labels: true } : {}),
      },
      readContext?.signal,
    ),
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
  signal?: AbortSignal,
  readContext?: AccountReadContext,
  projection: { sessionsStartingAfter?: number } = {},
): Promise<{
  entries: ScheduleReadItem[];
  reads: { resource: ResourceRef | null; asOf: string[] }[];
}> {
  const temporal = await getTemporal();
  const start = temporal.Instant.from(interval.starts_at),
    end = temporal.Instant.from(interval.ends_at);
  if (temporal.Instant.compare(start, end) >= 0) throw new Error("SCHEDULE_RANGE_INVALID");
  const backend = await scopedBackend(scope, signal, readContext);
  async function calendar(resource: ResourceRef | null) {
    const items: CalendarItem[] = [],
      asOf: string[] = [];
    const seenIds = new Set<string>(),
      seenCursors = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await queryBackendRead(
        backend,
        "calendar_get_v1",
        {
          client_api_version: 1,
          request_id: uuidv7(),
          org_id: scope.orgId,
          center_id: scope.centerId,
          interval: { ...interval },
          ...(resource ? { resource } : {}),
          page: { limit: 50, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
        },
        signal,
      );
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
  const items = first.items.filter((item) => {
    if (secondIds && !secondIds.has(`${item.type}:${item.id}`)) return false;
    return (
      projection.sessionsStartingAfter === undefined ||
      (item.type === "session" && Date.parse(item.starts_at) > projection.sessionsStartingAfter)
    );
  });
  const entries: ScheduleReadItem[] = [];
  // CalendarItem intentionally has no lifecycle state. Hydrate real sessions in
  // bounded batches instead of guessing planned state or current assignments.
  for (let index = 0; index < items.length; index += 4) {
    entries.push(
      ...(await Promise.all(
        items.slice(index, index + 4).map(async (item): Promise<ScheduleReadItem> => {
          if (item.type === "event") return { type: "event", item };
          const session = sessionIdentity(
            await queryBackendRead(
              backend,
              "session_get_v1",
              {
                client_api_version: 1,
                request_id: uuidv7(),
                org_id: scope.orgId,
                center_id: scope.centerId,
                session_id: item.id,
              },
              signal,
            ),
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
  signal?.throwIfAborted();
  return { entries, reads: pages.map(({ resource, asOf }) => ({ resource, asOf })) };
}

export async function readScheduleEditor(
  scope: ClientScope,
  sessionId: string,
  signal?: AbortSignal,
) {
  const backend = await scopedBackend(scope, signal);
  const [session, page] = await Promise.all([
    backend.call("session_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      session_id: sessionId,
    }),
    backend
      .call("management_state_get_v1", {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation: "session_change_preview_v1",
        selector: {
          operation: "session_change_preview_v1",
          key: { session_id: sessionId, scope: "single" },
        },
        page: { limit: 1 },
      })
      .catch((error: unknown) => {
        // Missing scheduling policy must not hide an independently readable session.
        // No empty resource list or writable editor is inferred from that failure.
        if (error instanceof BackendError && error.code === "POLICY_NOT_CONFIGURED") return null;
        throw error;
      }),
  ]);
  sessionIdentity(session, sessionId);
  if (!page) return { session, resources: null };
  const item = page.items[0];
  const versions = item?.versions.filter(
    (entry) => entry.entity.type === "sessions" && entry.entity.id === sessionId,
  );
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !item?.exists ||
    item.entity?.type !== "sessions" ||
    item.entity.id !== sessionId ||
    item.current?.operation !== "session_change_preview_v1" ||
    item.current.values.session_id !== sessionId ||
    versions?.length !== 1 ||
    versions[0]?.version !== session.version ||
    !Array.isArray(item.current.values.patch?.resources)
  )
    throw new Error("SCHEDULE_EDITOR_UNAVAILABLE");
  return { session, resources: item.current.values.patch.resources };
}

export async function readScheduleReplacements(
  scope: ClientScope,
  replacesId: string,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, readContext);
  const items: { id: string; version: number; state: SessionView["state"]; interval: Interval }[] =
    [];
  const ids = new Set<string>(),
    cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await backend.call("management_state_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: "replacement_session_create_v1",
      selector: { operation: "replacement_session_create_v1", key: { replaces_id: replacesId } },
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    });
    for (const item of page.items) {
      const values =
        item.current?.operation === "replacement_session_create_v1"
          ? item.current.values
          : undefined;
      const version = item.versions.filter(
        (row) => row.entity.type === "sessions" && row.entity.id === item.entity?.id,
      );
      if (
        !item.exists ||
        item.entity?.type !== "sessions" ||
        ids.has(item.entity.id) ||
        values?.replaces_id !== replacesId ||
        !values.interval ||
        version.length !== 1 ||
        !Number.isSafeInteger(version[0]!.version) ||
        version[0]!.version < 1 ||
        (item.state !== "planned" && item.state !== "occurred" && item.state !== "cancelled") ||
        !Number.isFinite(Date.parse(values.interval.starts_at)) ||
        !Number.isFinite(Date.parse(values.interval.ends_at)) ||
        Date.parse(values.interval.starts_at) >= Date.parse(values.interval.ends_at)
      )
        throw new Error("SCHEDULE_REPLACEMENT_UNAVAILABLE");
      ids.add(item.entity.id);
      items.push({
        id: item.entity.id,
        version: version[0]!.version,
        state: item.state,
        interval: values.interval,
      });
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw new Error("SCHEDULE_CURSOR_UNAVAILABLE");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return items;
}
