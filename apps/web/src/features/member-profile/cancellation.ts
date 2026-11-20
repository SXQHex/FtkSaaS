import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { ReservationView, RequestReservationCancel } from "@ftksaas/api-contracts";
import { readProfileRights } from "./profile-read";
import { readProfileReservation } from "./reservations";

export interface CancellationBase {
  scope: ClientScope;
  personId: string;
  reservation: ReservationView;
}
export interface CancellationIntent {
  base: CancellationBase;
  operation: "reservation_cancel_v1";
  request: Omit<RequestReservationCancel, "request_id">;
}
export async function readCancellation(
  scope: ClientScope,
  personId: string,
  id: string,
  sessionId: string,
): Promise<CancellationBase> {
  for (const value of [personId, id, sessionId]) z.uuid().parse(value);
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "reservation_cancel_v1",
    selector: { operation: "reservation_cancel_v1", key: { reservation_id: id } },
    page: { limit: 1 },
  });
  const item = page.items[0],
    versions =
      item?.versions.filter((v) => v.entity.type === "reservations" && v.entity.id === id) ?? [];
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !item?.exists ||
    item.entity?.type !== "reservations" ||
    item.entity.id !== id ||
    item.current?.operation !== "reservation_cancel_v1" ||
    item.current.values.reservation_id !== id ||
    versions.length !== 1
  )
    throw new Error("PROFILE_CANCELLATION_UNAVAILABLE");
  const row = await readProfileReservation(scope, personId, id, sessionId);
  if (row.version !== versions[0]!.version || row.state !== "active")
    throw new Error("PROFILE_CANCELLATION_UNAVAILABLE");
  return { scope: { ...scope }, personId, reservation: row };
}
export function cancellationIntent(base: CancellationBase, reason: string): CancellationIntent {
  const value = z.string().trim().min(1).parse(reason);
  return {
    base: structuredClone(base),
    operation: "reservation_cancel_v1",
    request: {
      client_api_version: 1,
      org_id: base.scope.orgId,
      center_id: base.scope.centerId,
      operation_key: uuidv7(),
      reservation_id: base.reservation.id,
      expected_version: base.reservation.version,
      reason: value,
    },
  };
}
export async function writeCancellation(intent: CancellationIntent) {
  const backend = await scopedBackend(intent.base.scope);
  const result = await backend.call("reservation_cancel_v1", {
    ...intent.request,
    request_id: uuidv7(),
  });
  if (result.primary_id !== intent.base.reservation.id)
    throw new Error("PROFILE_CANCELLATION_RESULT_UNAVAILABLE");
  return result;
}
export async function readCancellationReceipt(intent: CancellationIntent) {
  const backend = await scopedBackend(intent.base.scope),
    result = await backend.call("operation_status_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: intent.base.scope.orgId,
      operation: intent.operation,
      key: intent.request.operation_key,
    });
  if (
    result.operation !== intent.operation ||
    result.key !== intent.request.operation_key ||
    (result.result_reference &&
      (result.result_reference.type !== "reservations" ||
        result.result_reference.id !== intent.base.reservation.id))
  )
    throw new Error("PROFILE_CANCELLATION_RECEIPT_UNAVAILABLE");
  return result;
}
export async function readCancellationResult(intent: CancellationIntent, id?: string) {
  const { scope, personId, reservation: before } = intent.base;
  if (id !== before.id) throw new Error("PROFILE_CANCELLATION_RESULT_UNAVAILABLE");
  const row = await readProfileReservation(scope, personId, before.id, before.session_id);
  if (row.state !== "cancelled" || row.version <= before.version)
    throw new Error("PROFILE_CANCELLATION_RESULT_UNAVAILABLE");
  const backend = await scopedBackend(scope);
  const session = await backend.call("session_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    session_id: before.session_id,
  });
  if (session.id !== before.session_id) throw new Error("PROFILE_CANCELLATION_RESULT_UNAVAILABLE");
  const rights = await readProfileRights(scope, personId);
  return { reservation: row, rights };
}
export type CancellationResult = Awaited<ReturnType<typeof readCancellationResult>>;
