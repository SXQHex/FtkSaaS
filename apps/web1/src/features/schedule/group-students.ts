import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  EntitlementView,
  Interval,
  RequestReservationCreate,
} from "../../lib/api-contracts/generated";
import { readProfileRights } from "../member-profile/profile-read";
import { readScheduleSession } from "./schedule-read";

const request = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  request_id: uuidv7(),
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export async function readGroupStudents(
  scope: ClientScope,
  classId: string,
  interval: Interval,
  query = "",
  cursor?: string,
) {
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    ...request(scope),
    operation: "reservation_cancel_v1",
    selector: {
      operation: "reservation_cancel_v1",
      key: {
        directory: "class",
        class_id: classId,
        interval: { ...interval },
        status: "active",
        ...(query.trim() ? { query: query.trim() } : {}),
      },
    },
    page: { limit: 20, ...(cursor ? { cursor } : {}) },
  });
  const ids = new Set<string>();
  const items = page.items.map((item) => {
    const student = item.group_student;
    if (
      !student ||
      item.entity?.type !== "people" ||
      item.entity.id !== student.person_id ||
      item.current !== null ||
      ids.has(student.person_id)
    )
      throw new Error("SCHEDULE_GROUP_UNAVAILABLE");
    ids.add(z.uuid().parse(student.person_id));
    const reservations = new Set<string>();
    for (const row of student.reservations) {
      z.iso.datetime({ offset: true }).parse(row.starts_at);
      z.iso.datetime({ offset: true }).parse(row.ends_at);
      if (
        reservations.has(row.id) ||
        row.mode !== "priority" ||
        row.state !== "active" ||
        Date.parse(row.ends_at) <= Date.parse(interval.starts_at) ||
        Date.parse(row.starts_at) >= Date.parse(row.ends_at) ||
        Date.parse(row.starts_at) >= Date.parse(interval.ends_at)
      )
        throw new Error("SCHEDULE_GROUP_UNAVAILABLE");
      reservations.add(z.uuid().parse(row.id));
      z.number().int().positive().parse(row.version);
    }
    return student;
  });
  return { items, next_cursor: page.next_cursor, as_of: page.as_of };
}
export interface PriorityIntent {
  scope: ClientScope;
  request: Omit<RequestReservationCreate, "request_id">;
}
export function priorityIntent(
  scope: ClientScope,
  personId: string,
  sessionId: string,
  sale: EntitlementView,
): PriorityIntent {
  if (sale.person_id !== personId || sale.state !== "active" || sale.booking_mode !== "priority")
    throw new Error("SCHEDULE_GROUP_SOURCE_UNAVAILABLE");
  return {
    scope: { ...scope },
    request: {
      client_api_version: 1,
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: uuidv7(),
      person_id: z.uuid().parse(personId),
      session_id: z.uuid().parse(sessionId),
      source_sale_id: z.uuid().parse(sale.sale_id),
      mode: "priority",
    },
  };
}
export async function writePriority(intent: PriorityIntent) {
  const backend = await scopedBackend(intent.scope);
  const result = await backend.call("reservation_create_v1", {
    ...intent.request,
    request_id: uuidv7(),
  });
  z.uuid().parse(result.primary_id);
  return result;
}
export async function readPriorityReceipt(intent: PriorityIntent) {
  const backend = await scopedBackend(intent.scope);
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: "reservation_create_v1",
    key: intent.request.operation_key,
  });
  if (
    receipt.operation !== "reservation_create_v1" ||
    receipt.key !== intent.request.operation_key ||
    (receipt.result_reference && receipt.result_reference.type !== "reservations")
  )
    throw new Error("SCHEDULE_GROUP_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readPriorityResult(intent: PriorityIntent, id?: string) {
  const backend = await scopedBackend(intent.scope);
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await backend.call("reservation_list_v1", {
      ...request(intent.scope),
      person_id: intent.request.person_id,
      session_id: intent.request.session_id,
      include_source_summary: true,
      page: { limit: 20, ...(cursor ? { cursor } : {}) },
    });
    if (
      page.items.some(
        (row) =>
          row.person_id !== intent.request.person_id ||
          row.session_id !== intent.request.session_id,
      )
    )
      throw new Error("SCHEDULE_GROUP_RESULT_UNAVAILABLE");
    const matches = page.items.filter(
      (row) => (!id || row.id === id) && row.state === "active" && row.mode === "priority",
    );
    if (matches.length > 1) throw new Error("SCHEDULE_GROUP_RESULT_UNAVAILABLE");
    const reservation = matches[0];
    if (reservation) {
      const source = reservation.source_summary;
      if (source?.status !== "available" || source.source_sale_id !== intent.request.source_sale_id)
        throw new Error("SCHEDULE_GROUP_RESULT_UNAVAILABLE");
      const [rights, session] = await Promise.all([
        readProfileRights(intent.scope, intent.request.person_id),
        readScheduleSession(intent.scope, intent.request.session_id),
      ]);
      if (!rights.some((row) => row.sale_id === intent.request.source_sale_id))
        throw new Error("SCHEDULE_GROUP_RESULT_UNAVAILABLE");
      return { reservation, rights, session };
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw new Error("SCHEDULE_GROUP_RESULT_UNAVAILABLE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  throw new Error("SCHEDULE_GROUP_RESULT_UNAVAILABLE");
}
