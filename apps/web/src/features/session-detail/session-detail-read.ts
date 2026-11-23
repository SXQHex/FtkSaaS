import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import type {
  AttendanceView,
  PersonView,
  WaitlistEntryView,
  SessionView,
} from "@ftksaas/api-contracts";
import { readScheduleSession } from "../schedule/schedule-read";

export async function readSessionHeader(
  scope: ClientScope,
  session: Pick<SessionView, "id" | "starts_at" | "ends_at">,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, readContext),
    cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await backend.call("calendar_get_v1", {
      ...common(scope),
      request_id: uuidv7(),
      interval: { starts_at: session.starts_at, ends_at: session.ends_at },
      page: { limit: 50, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
    });
    const matches = page.items.filter((row) => row.type === "session" && row.id === session.id);
    if (matches.length > 1) throw new Error("SESSION_DETAIL_HEADER_UNAVAILABLE");
    if (matches[0]) {
      const row = matches[0];
      if (
        row.center_id !== scope.centerId ||
        Date.parse(row.starts_at) !== Date.parse(session.starts_at) ||
        Date.parse(row.ends_at) !== Date.parse(session.ends_at)
      )
        throw new Error("SESSION_DETAIL_HEADER_UNAVAILABLE");
      return row;
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw new Error("SESSION_DETAIL_HEADER_UNAVAILABLE");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  throw new Error("SESSION_DETAIL_HEADER_UNAVAILABLE");
}

const positive = z.number().int().positive().safe();
const nonnegative = z.number().int().nonnegative().safe();
const instant = z.iso.datetime({ offset: true });
function common(scope: ClientScope) {
  return { client_api_version: 1 as const, org_id: scope.orgId, center_id: scope.centerId };
}
function checkedPage(page: { next_cursor?: string | null; items: unknown[] }, cursor?: string) {
  if (page.items.length > 20 || (cursor && page.next_cursor === cursor))
    throw new Error("SESSION_DETAIL_PAGE_UNAVAILABLE");
}
async function visiblePerson(
  backend: Awaited<ReturnType<typeof scopedBackend>>,
  scope: ClientScope,
  personId: string,
): Promise<PersonView | undefined> {
  try {
    const person = await backend.call("person_get_v1", {
      ...common(scope),
      request_id: uuidv7(),
      person_id: personId,
    });
    if (person.id !== personId) throw new Error("SESSION_DETAIL_PERSON_UNAVAILABLE");
    return person;
  } catch (error) {
    // A readable reservation does not grant a separate person reader's authority.
    if (error instanceof BackendError && ["FORBIDDEN", "NOT_FOUND"].includes(error.code))
      return undefined;
    throw error;
  }
}
export async function readSessionParticipants(
  scope: ClientScope,
  sessionId: string,
  personId?: string,
  cursor?: string,
  readContext?: AccountReadContext,
) {
  z.uuid().parse(sessionId);
  if (personId) z.uuid().parse(personId);
  const backend = await scopedBackend(scope, undefined, readContext);
  const page = await backend.call("reservation_list_v1", {
    ...common(scope),
    request_id: uuidv7(),
    session_id: sessionId,
    include_source_summary: true,
    ...(personId ? { person_id: personId } : {}),
    page: { limit: 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  checkedPage(page, cursor);
  instant.parse(page.as_of);
  const ids = new Set<string>();
  for (const row of page.items) {
    z.uuid().parse(row.id);
    z.uuid().parse(row.person_id);
    positive.parse(row.version);
    z.enum(["active", "cancelled", "completed"]).parse(row.state);
    z.enum(["priority", "flexible"]).parse(row.mode);
    if (row.booking_category != null) z.enum(["male", "female"]).parse(row.booking_category);
    if (row.session_id !== sessionId || (personId && row.person_id !== personId) || ids.has(row.id))
      throw new Error("SESSION_DETAIL_RESERVATIONS_UNAVAILABLE");
    ids.add(row.id);
  }
  const people = new Map<string, PersonView | undefined>();
  const personIds = [...new Set(page.items.map((row) => row.person_id))];
  for (let i = 0; i < personIds.length; i += 4)
    await Promise.all(
      personIds
        .slice(i, i + 4)
        .map(async (id) => people.set(id, await visiblePerson(backend, scope, id))),
    );
  return {
    items: page.items.map((reservation) => ({
      reservation,
      person: people.get(reservation.person_id),
    })),
    next_cursor: page.next_cursor,
    as_of: page.as_of,
  };
}

export function validateSessionAttendance(view: AttendanceView, sessionId: string) {
  if (view.session_id !== sessionId) throw new Error("SESSION_DETAIL_ATTENDANCE_UNAVAILABLE");
  positive.parse(view.session_version);
  nonnegative.parse(view.revision);
  z.enum(["open", "closed"]).parse(view.closure_state);
  if (view.actual_started_at) instant.parse(view.actual_started_at);
  if (view.attendance_window != null) {
    const { policy_id, opens_at, closes_at } = view.attendance_window;
    z.uuid().parse(policy_id);
    if (Date.parse(instant.parse(opens_at)) >= Date.parse(instant.parse(closes_at)))
      throw new Error("SESSION_DETAIL_ATTENDANCE_UNAVAILABLE");
  }
  if (view.correction_requests !== undefined) {
    z.array(
      z.object({
        id: z.uuid(),
        instructor_id: z.uuid(),
        closure_revision: positive,
        reason: z.string().trim().min(1).max(1000),
        state: z.enum(["pending", "accepted", "declined"]),
        version: positive,
        created_at: instant,
        reviewed_at: instant.nullable(),
      }),
    ).parse(view.correction_requests);
  }
  const ids = new Set<string>();
  for (const row of view.entries) {
    z.uuid().parse(row.reservation_id);
    z.uuid().parse(row.person_id);
    positive.parse(row.version);
    z.enum(["unmarked", "attended", "no_show", "blocked"]).parse(row.result);
    z.boolean().parse(row.protected);
    if (ids.has(row.reservation_id)) throw new Error("SESSION_DETAIL_ATTENDANCE_UNAVAILABLE");
    ids.add(row.reservation_id);
    if (row.blocked_reason != null)
      z.enum(["credit_limit_exceeded", "debt_policy"]).parse(row.blocked_reason);
  }
  return view;
}
export async function readSessionAttendance(
  scope: ClientScope,
  sessionId: string,
  readContext?: AccountReadContext,
) {
  z.uuid().parse(sessionId);
  const backend = await scopedBackend(scope, undefined, readContext);
  return validateSessionAttendance(
    await backend.call("attendance_get_v1", {
      ...common(scope),
      request_id: uuidv7(),
      session_id: sessionId,
      include_correction_requests: true,
    }),
    sessionId,
  );
}
export async function readSessionInstructors(
  scope: ClientScope,
  sessionId: string,
  includeRoomLabels = false,
  readContext?: AccountReadContext,
) {
  const session = await readScheduleSession(scope, sessionId, includeRoomLabels, readContext),
    backend = await scopedBackend(scope, undefined, readContext);
  const ids = [
    ...new Set(
      session.assignments.filter((row) => row.duty === "instructor").map((row) => row.person_id),
    ),
  ];
  const people = new Map<string, PersonView | undefined>();
  for (let i = 0; i < ids.length; i += 4)
    await Promise.all(
      ids
        .slice(i, i + 4)
        .map(async (id) => people.set(id, await visiblePerson(backend, scope, id))),
    );
  return { session, instructors: ids.map((id) => ({ id, person: people.get(id) })) };
}

export async function readPersonSessionWaitlist(
  scope: ClientScope,
  sessionId: string,
  personId: string,
  cursor?: string,
) {
  z.uuid().parse(sessionId);
  z.uuid().parse(personId);
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
    operation: "waitlist_join_v1",
    selector: {
      operation: "waitlist_join_v1",
      key: { session_id: sessionId, person_id: personId },
    },
    page: { limit: 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  checkedPage(page, cursor);
  const ids = new Set<string>();
  const items: WaitlistEntryView[] = page.items.map((row) => {
    const detail = row.waitlist_detail;
    if (
      !detail ||
      row.operation !== "waitlist_join_v1" ||
      !row.exists ||
      row.entity?.type !== "waitlist_entries" ||
      row.entity.id !== detail.id ||
      detail.session_id !== sessionId ||
      detail.person_id !== personId ||
      detail.center_id !== scope.centerId ||
      ids.has(detail.id)
    )
      throw new Error("SESSION_DETAIL_WAITLIST_UNAVAILABLE");
    ids.add(z.uuid().parse(detail.id));
    positive.parse(detail.version);
    const ownVersions = row.versions.filter(
      (version) => version.entity.type === "waitlist_entries" && version.entity.id === detail.id,
    );
    if (
      ownVersions.length !== 1 ||
      ownVersions[0]!.version !== detail.version ||
      row.state !== detail.state
    )
      throw new Error("SESSION_DETAIL_WAITLIST_UNAVAILABLE");
    instant.parse(detail.created_at);
    instant.parse(detail.joined_at);
    z.enum(["waiting", "offered", "converted", "left", "closed"]).parse(detail.state);
    const offers = new Set<string>();
    for (const offer of detail.offers) {
      if (
        offer.entry_id !== detail.id ||
        offer.session_id !== sessionId ||
        offer.person_id !== personId ||
        offers.has(offer.id)
      )
        throw new Error("SESSION_DETAIL_OFFER_UNAVAILABLE");
      offers.add(z.uuid().parse(offer.id));
      positive.parse(offer.version);
      instant.parse(offer.created_at);
      instant.parse(offer.expires_at);
      z.enum(["active", "accepted", "rejected", "expired", "withdrawn"]).parse(offer.state);
    }
    return detail;
  });
  // This is an explicitly selected person's history, never the session directory.
  return { items, next_cursor: page.next_cursor };
}

/** Two independent cursor chains; never infer totals or global ranks from a page. */
export async function readSessionWaitlist(
  scope: ClientScope,
  sessionId: string,
  view: "entries" | "offers",
  cursor?: string,
  readContext?: AccountReadContext,
) {
  z.uuid().parse(sessionId);
  const backend = await scopedBackend(scope, undefined, readContext);
  const page = await backend.call("management_state_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
    operation: "waitlist_join_v1",
    selector: {
      operation: "waitlist_join_v1",
      key: { directory: "session", session_id: sessionId, view },
    },
    page: { limit: 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  checkedPage(page, cursor);
  const seen = new Set<string>();
  const items = page.items.map((row) => {
    const entry = row.waitlist_detail;
    const offer = entry?.offers[0];
    const entityType = view === "entries" ? "waitlist_entries" : "seat_offers";
    const id = view === "entries" ? entry?.id : offer?.id;
    const version = view === "entries" ? entry?.version : offer?.version;
    const state = view === "entries" ? entry?.state : offer?.state;
    if (
      !entry ||
      !id ||
      !row.exists ||
      row.operation !== "waitlist_join_v1" ||
      row.entity?.type !== entityType ||
      row.entity.id !== id ||
      seen.has(id) ||
      entry.center_id !== scope.centerId ||
      entry.session_id !== sessionId ||
      row.state !== state ||
      !row.waitlist_display_name?.trim() ||
      (view === "entries" ? entry.offers.length !== 0 : entry.offers.length !== 1) ||
      (offer &&
        (offer.entry_id !== entry.id ||
          offer.session_id !== sessionId ||
          offer.person_id !== entry.person_id)) ||
      row.versions.filter(
        (v) => v.entity.type === entityType && v.entity.id === id && v.version === version,
      ).length !== 1
    )
      throw new Error("SESSION_DETAIL_WAITLIST_UNAVAILABLE");
    seen.add(z.uuid().parse(id));
    z.uuid().parse(entry.person_id);
    positive.parse(entry.version);
    instant.parse(entry.joined_at);
    z.enum(["waiting", "offered", "converted", "left", "closed"]).parse(entry.state);
    if (offer) {
      positive.parse(offer.version);
      instant.parse(offer.expires_at);
      z.enum(["active", "accepted", "rejected", "expired", "withdrawn"]).parse(offer.state);
    }
    return { id, name: row.waitlist_display_name, entry, offer };
  });
  return { items, next_cursor: page.next_cursor, asOf: instant.parse(page.as_of) };
}
