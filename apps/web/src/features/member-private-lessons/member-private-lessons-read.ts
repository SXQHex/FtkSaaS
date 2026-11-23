import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import { requestDetail } from "../lesson-requests/lesson-requests-read";
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  request_id: uuidv7(),
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export async function readOwnRequests(
  scope: ClientScope,
  personId: string,
  cursor?: string,
  requestId?: string,
  readContext?: AccountReadContext,
) {
  z.uuid().parse(personId);
  const backend = await scopedBackend(scope, undefined, readContext);
  const page = await backend.call("management_state_get_v1", {
    ...common(scope),
    operation: "lesson_request_create_v1",
    selector: {
      operation: "lesson_request_create_v1",
      key: {
        person_id: personId,
        ...(requestId ? { lesson_request_id: z.uuid().parse(requestId) } : {}),
      },
    },
    page: { limit: 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  const items = page.items.map((row) => requestDetail(row, scope, "lesson_request_create_v1"));
  if (
    items.length > 20 ||
    (requestId && (items.length !== 1 || items[0]!.id !== requestId || !!page.next_cursor)) ||
    items.some((row) => row.person_id !== personId || row.format !== "private") ||
    new Set(items.map((row) => row.id)).size !== items.length ||
    (cursor && page.next_cursor === cursor)
  )
    throw new Error("OWN_REQUEST_SOURCE_UNAVAILABLE");
  return {
    items,
    nextCursor: page.next_cursor,
    asOf: z.iso.datetime({ offset: true }).parse(page.as_of),
  };
}
export async function readOwnRequest(scope: ClientScope, personId: string, id: string) {
  z.uuid().parse(id);
  z.uuid().parse(personId);
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    ...common(scope),
    operation: "lesson_request_withdraw_v1",
    selector: { operation: "lesson_request_withdraw_v1", key: { lesson_request_id: id } },
    page: { limit: 1 },
  });
  if (page.items.length !== 1 || page.next_cursor)
    throw new Error("OWN_REQUEST_SOURCE_UNAVAILABLE");
  const request = requestDetail(page.items[0]!, scope, "lesson_request_withdraw_v1", id);
  if (request.person_id !== personId || request.format !== "private")
    throw new Error("OWN_REQUEST_SOURCE_UNAVAILABLE");
  return { request, asOf: z.iso.datetime({ offset: true }).parse(page.as_of) };
}
export async function readOwnRequestChoices(
  scope: ClientScope,
  personId: string,
  kind: "disciplines" | "instructors",
  readContext?: AccountReadContext,
) {
  z.uuid().parse(personId);
  const backend = await scopedBackend(scope, undefined, readContext),
    items: { id: string; name: string }[] = [],
    ids = new Set<string>(),
    cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await backend.call("management_state_get_v1", {
      ...common(scope),
      operation: "lesson_request_create_v1",
      selector: {
        operation: "lesson_request_create_v1",
        key: { person_id: personId, catalog: kind },
      },
      page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    if (page.items.length > 50) throw new Error("OWN_REQUEST_CHOICES_UNAVAILABLE");
    for (const row of page.items) {
      const values =
        row.current?.operation === "lesson_request_create_v1" ? row.current.values : undefined;
      const id = kind === "disciplines" ? values?.discipline_id : values?.preferred_instructor_id;
      if (
        !row.exists ||
        row.entity?.type !== (kind === "disciplines" ? "disciplines" : "people") ||
        !id ||
        row.entity.id !== id ||
        !values?.display_name ||
        ids.has(id)
      )
        throw new Error("OWN_REQUEST_CHOICES_UNAVAILABLE");
      ids.add(z.uuid().parse(id));
      items.push({ id, name: values.display_name });
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw new Error("OWN_REQUEST_CHOICES_UNAVAILABLE");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return items;
}
