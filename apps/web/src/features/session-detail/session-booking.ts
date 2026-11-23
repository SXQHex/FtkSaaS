import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type {
  BookingMode,
  EntitlementView,
  RequestReservationCreate,
  RequestReservationCapacityOverride,
} from "@ftksaas/api-contracts";
import type { SessionBookingDraft } from "./session-detail-panels";
import { readScheduleSession } from "../schedule/schedule-read";
import { readProfileRights } from "../member-profile/profile-read";

export async function readBookingRights(
  scope: ClientScope,
  personId: string,
  sessionId: string,
  mode: BookingMode,
  readContext?: AccountReadContext,
) {
  z.uuid().parse(personId);
  z.uuid().parse(sessionId);
  const backend = await scopedBackend(scope, undefined, readContext);
  const rows = await backend.call("entitlements_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: personId,
    session_id: sessionId,
    booking_mode: mode,
    include_timed_rights: true,
  });
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.person_id !== personId || ids.has(row.sale_id))
      throw new Error("SESSION_BOOKING_RIGHTS_UNAVAILABLE");
    ids.add(z.uuid().parse(row.sale_id));
    if (row.available_at_session !== undefined)
      z.number().int().nonnegative().safe().parse(row.available_at_session);
  }
  return rows;
}
export async function readCapacityOverride(
  scope: ClientScope,
  personId: string,
  sessionId: string,
  saleId: string,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, readContext);
  const key = {
    person_id: z.uuid().parse(personId),
    session_id: z.uuid().parse(sessionId),
    source_sale_id: z.uuid().parse(saleId),
  };
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "reservation_capacity_override_v1",
    selector: { operation: "reservation_capacity_override_v1", key },
    page: { limit: 1 },
  });
  const row = page.items[0],
    version = row?.versions.filter(
      (v) => v.entity.type === "sessions" && v.entity.id === sessionId,
    );
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !row?.exists ||
    row.entity?.type !== "sessions" ||
    row.entity.id !== sessionId ||
    row.current?.operation !== "reservation_capacity_override_v1" ||
    row.current.values.person_id !== personId ||
    row.current.values.session_id !== sessionId ||
    row.current.values.source_sale_id !== saleId ||
    version?.length !== 1
  )
    throw new Error("SESSION_BOOKING_OVERRIDE_UNAVAILABLE");
  return z.number().int().positive().safe().parse(version[0]!.version);
}
export type SessionBookingIntent = {
  scope: ClientScope;
} & (
  | { operation: "reservation_create_v1"; request: Omit<RequestReservationCreate, "request_id"> }
  | {
      operation: "reservation_capacity_override_v1";
      request: Omit<RequestReservationCapacityOverride, "request_id">;
    }
);
export function sessionBookingIntent(
  scope: ClientScope,
  sessionId: string,
  draft: SessionBookingDraft,
  sale: EntitlementView,
  canOverride: boolean,
): SessionBookingIntent {
  if (
    !draft.reviewed ||
    sale.person_id !== draft.personId ||
    sale.sale_id !== draft.saleId ||
    sale.state !== "active" ||
    sale.booking_mode !== draft.mode
  )
    throw new Error("SESSION_BOOKING_SOURCE_UNAVAILABLE");
  const request = {
    client_api_version: 1 as const,
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation_key: uuidv7(),
    person_id: z.uuid().parse(draft.personId),
    session_id: z.uuid().parse(sessionId),
    source_sale_id: z.uuid().parse(sale.sale_id),
    mode: draft.mode,
    ...(draft.category ? { booking_category: draft.category } : {}),
  };
  if (!draft.override) return { scope: { ...scope }, operation: "reservation_create_v1", request };
  if (!canOverride) throw new Error("SESSION_BOOKING_OVERRIDE_UNAVAILABLE");
  return {
    scope: { ...scope },
    operation: "reservation_capacity_override_v1",
    request: { ...request, reason: z.string().trim().min(1).parse(draft.reason) },
  };
}
export async function writeSessionBooking(intent: SessionBookingIntent) {
  const backend = await scopedBackend(intent.scope);
  if (intent.operation === "reservation_capacity_override_v1")
    return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
}
export async function readSessionBookingReceipt(intent: SessionBookingIntent) {
  const backend = await scopedBackend(intent.scope);
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  if (
    receipt.operation !== intent.operation ||
    receipt.key !== intent.request.operation_key ||
    (receipt.result_reference && receipt.result_reference.type !== "reservations")
  )
    throw new Error("SESSION_BOOKING_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readSessionBookingResult(intent: SessionBookingIntent, id?: string) {
  const backend = await scopedBackend(intent.scope),
    seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await backend.call("reservation_list_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: intent.scope.orgId,
      center_id: intent.scope.centerId,
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
      throw new Error("SESSION_BOOKING_RESULT_UNAVAILABLE");
    const matches = page.items.filter(
      (row) =>
        (id ? row.id === id : row.state === "active") &&
        row.mode === intent.request.mode &&
        (!intent.request.booking_category ||
          row.booking_category === intent.request.booking_category),
    );
    if (matches.length > 1) throw new Error("SESSION_BOOKING_RESULT_UNAVAILABLE");
    const reservation = matches[0];
    if (reservation) {
      const source = reservation.source_summary;
      if (source?.status !== "available" || source.source_sale_id !== intent.request.source_sale_id)
        throw new Error("SESSION_BOOKING_RESULT_UNAVAILABLE");
      const [session, rights] = await Promise.all([
        readScheduleSession(intent.scope, intent.request.session_id),
        readProfileRights(intent.scope, intent.request.person_id),
      ]);
      if (!rights.some((row) => row.sale_id === intent.request.source_sale_id))
        throw new Error("SESSION_BOOKING_RESULT_UNAVAILABLE");
      return { session, rights, reservation };
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw new Error("SESSION_BOOKING_RESULT_UNAVAILABLE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  throw new Error("SESSION_BOOKING_RESULT_UNAVAILABLE");
}
