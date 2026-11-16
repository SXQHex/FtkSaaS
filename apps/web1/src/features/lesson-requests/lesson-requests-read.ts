import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  LessonRequestView,
  ManagementStateView,
  PersonView,
} from "../../lib/api-contracts/generated";
import { getTemporal } from "../../lib/temporal";
import { readScheduleSession } from "../schedule/schedule-read";
const positive = z.number().int().positive().safe(),
  instant = z.iso.datetime({ offset: true });
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export function requestDetail(
  row: ManagementStateView,
  scope: ClientScope,
  operation: string,
  id?: string,
): LessonRequestView {
  const detail = row.request_detail;
  if (
    !detail ||
    !row.exists ||
    row.operation !== operation ||
    row.entity?.type !== "lesson_requests" ||
    row.entity.id !== detail.id ||
    detail.center_id !== scope.centerId ||
    (id && detail.id !== id) ||
    row.state !== detail.state ||
    row.versions.filter(
      (v) =>
        v.entity.type === "lesson_requests" &&
        v.entity.id === detail.id &&
        v.version === detail.version,
    ).length !== 1
  )
    throw new Error("LESSON_REQUEST_SOURCE_UNAVAILABLE");
  for (const value of [detail.id, detail.person_id, detail.discipline_id]) z.uuid().parse(value);
  if (detail.preferred_instructor_id) z.uuid().parse(detail.preferred_instructor_id);
  if (detail.reservation_id) z.uuid().parse(detail.reservation_id);
  positive.parse(detail.version);
  positive.parse(detail.duration_minutes);
  instant.parse(detail.requested_start);
  instant.parse(detail.created_at);
  if (detail.expires_at) instant.parse(detail.expires_at);
  z.enum(["pending", "alternative_offered", "approved", "rejected", "withdrawn", "expired"]).parse(
    detail.state,
  );
  const seen = new Set<string>();
  for (const alternative of detail.alternatives) {
    if (
      alternative.request_id !== detail.id ||
      seen.has(alternative.id) ||
      Date.parse(alternative.ends_at) <= Date.parse(alternative.starts_at)
    )
      throw new Error("LESSON_REQUEST_ALTERNATIVE_UNAVAILABLE");
    seen.add(z.uuid().parse(alternative.id));
    positive.parse(alternative.version);
    instant.parse(alternative.starts_at);
    instant.parse(alternative.ends_at);
    z.enum(["offered", "accepted", "rejected", "superseded", "expired"]).parse(alternative.state);
    if (alternative.instructor_id) z.uuid().parse(alternative.instructor_id);
  }
  return detail;
}
export async function readLessonRequest(scope: ClientScope, id: string) {
  z.uuid().parse(id);
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
    operation: "lesson_request_reject_v1",
    selector: { operation: "lesson_request_reject_v1", key: { lesson_request_id: id } },
    page: { limit: 1 },
  });
  if (page.items.length !== 1 || page.next_cursor)
    throw new Error("LESSON_REQUEST_SOURCE_UNAVAILABLE");
  return requestDetail(page.items[0]!, scope, "lesson_request_reject_v1", id);
}
export async function readLessonRequests(scope: ClientScope, cursor?: string) {
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
    operation: "lesson_request_create_v1",
    selector: { operation: "lesson_request_create_v1", key: {} },
    page: { limit: 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  if (page.items.length > 20 || (cursor && page.next_cursor === cursor))
    throw new Error("LESSON_REQUEST_PAGE_UNAVAILABLE");
  const details = page.items.map((row) => requestDetail(row, scope, "lesson_request_create_v1"));
  if (new Set(details.map((row) => row.id)).size !== details.length)
    throw new Error("LESSON_REQUEST_PAGE_UNAVAILABLE");
  const ids = [
    ...new Set(
      details.flatMap((row) => [
        row.person_id,
        ...(row.preferred_instructor_id ? [row.preferred_instructor_id] : []),
      ]),
    ),
  ];
  const people = new Map<string, PersonView | undefined>();
  for (let offset = 0; offset < ids.length; offset += 4)
    await Promise.all(
      ids.slice(offset, offset + 4).map(async (id) => {
        try {
          const person = await backend.call("person_get_v1", {
            ...common(scope),
            request_id: uuidv7(),
            person_id: id,
            include_member_summary: true,
          });
          if (person.id !== id) throw new Error("LESSON_REQUEST_PERSON_UNAVAILABLE");
          people.set(id, person);
        } catch (error) {
          if (error instanceof BackendError && ["FORBIDDEN", "NOT_FOUND"].includes(error.code))
            people.set(id, undefined);
          else throw error;
        }
      }),
    );
  return {
    items: details.map((detail) => ({
      detail,
      person: people.get(detail.person_id),
      instructor: detail.preferred_instructor_id
        ? people.get(detail.preferred_instructor_id)
        : undefined,
    })),
    next_cursor: page.next_cursor,
  };
}
export async function requestInterval(request: LessonRequestView) {
  const temporal = await getTemporal();
  if (request.state === "alternative_offered") {
    const accepted = request.alternatives.filter((row) => row.state === "accepted");
    if (accepted.length !== 1) throw new Error("LESSON_REQUEST_ALTERNATIVE_NOT_ACCEPTED");
    return {
      interval: { starts_at: accepted[0]!.starts_at, ends_at: accepted[0]!.ends_at },
      instructorId: accepted[0]!.instructor_id ?? undefined,
    };
  }
  const start = temporal.Instant.from(request.requested_start);
  return {
    interval: {
      starts_at: start.toString(),
      ends_at: start.add({ minutes: request.duration_minutes }).toString(),
    },
    instructorId: request.preferred_instructor_id ?? undefined,
  };
}
export async function readRequestSessions(scope: ClientScope, request: LessonRequestView) {
  const backend = await scopedBackend(scope),
    { interval, instructorId } = await requestInterval(request),
    seen = new Set<string>(),
    ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await backend.call("calendar_get_v1", {
      ...common(scope),
      request_id: uuidv7(),
      interval,
      page: { limit: 50, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
    });
    for (const row of page.items)
      if (
        row.type === "session" &&
        row.center_id === scope.centerId &&
        Date.parse(row.starts_at) === Date.parse(interval.starts_at) &&
        Date.parse(row.ends_at) === Date.parse(interval.ends_at)
      )
        ids.add(row.id);
    cursor = page.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw new Error("LESSON_REQUEST_SESSIONS_UNAVAILABLE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  const sessions = [];
  for (const id of ids) {
    const session = await readScheduleSession(scope, id);
    if (
      session.format === "private" &&
      session.discipline_id === request.discipline_id &&
      session.state === "planned" &&
      session.attendance_state === "open" &&
      Date.parse(session.starts_at) === Date.parse(interval.starts_at) &&
      Date.parse(session.ends_at) === Date.parse(interval.ends_at) &&
      (!instructorId ||
        session.assignments.some(
          (row) => row.duty === "instructor" && row.person_id === instructorId,
        ))
    )
      sessions.push(session);
  }
  return sessions;
}
export async function readRequestInstructors(scope: ClientScope, personId: string) {
  const backend = await scopedBackend(scope),
    items: { id: string; name: string }[] = [],
    seen = new Set<string>(),
    ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await backend.call("management_state_get_v1", {
      ...common(scope),
      request_id: uuidv7(),
      operation: "lesson_request_create_v1",
      selector: {
        operation: "lesson_request_create_v1",
        key: { person_id: personId, catalog: "instructors" },
      },
      page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    for (const row of page.items) {
      const values =
        row.current?.operation === "lesson_request_create_v1" ? row.current.values : undefined;
      if (
        !row.exists ||
        row.entity?.type !== "people" ||
        !values?.preferred_instructor_id ||
        row.entity.id !== values.preferred_instructor_id ||
        !values.display_name ||
        ids.has(row.entity.id)
      )
        throw new Error("LESSON_REQUEST_INSTRUCTORS_UNAVAILABLE");
      ids.add(z.uuid().parse(row.entity.id));
      items.push({ id: row.entity.id, name: values.display_name });
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw new Error("LESSON_REQUEST_INSTRUCTORS_UNAVAILABLE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  return items;
}
