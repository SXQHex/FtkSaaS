import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  CreditProtectionChange,
  ValidityProtectionChange,
  RequestCreditAdjust,
  RequestEntitlementExtend,
  ReservationProtectionPreview,
  EntitlementView,
} from "../../lib/api-contracts/generated";
import { readProfileRights } from "./profile-read";
import { readProfileReservation } from "./reservations";
import { getTemporal } from "../../lib/temporal";

export type RightAction = "adjust" | "extend";
const reason = z.string().trim().min(1);
const adjustment = z.object({
  quantity: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .transform(Number)
    .pipe(z.number().int().positive().safe()),
  direction: z.enum(["increase", "decrease"]),
  reason,
});
const extension = z.object({ endDate: z.iso.date(), reason });
export interface RightReview {
  scope: ClientScope;
  personId: string;
  action: RightAction;
  before: EntitlementView & { account_id: string; version: number };
  change: CreditProtectionChange | ValidityProtectionChange;
  reason: string;
  preview: ReservationProtectionPreview;
  affected: { id: string; startsAt: string }[];
}
async function source(scope: ClientScope, personId: string, saleId: string) {
  z.uuid().parse(saleId);
  const rights = await readProfileRights(scope, personId),
    row = rights.find((x) => x.sale_id === saleId);
  if (!row || row.state !== "active" || row.sale_state !== "active")
    throw new Error("PROFILE_RIGHT_SOURCE_UNAVAILABLE");
  return {
    ...row,
    account_id: z.uuid().parse(row.account_id),
    version: z.number().int().positive().safe().parse(row.version),
  };
}
export async function previewRightAdjustment(
  scope: ClientScope,
  personId: string,
  saleId: string,
  action: RightAction,
  draft: unknown,
): Promise<RightReview> {
  const value = action === "adjust" ? adjustment.parse(draft) : extension.parse(draft);
  const before = await source(scope, personId, saleId);
  let change: RightReview["change"];
  if ("quantity" in value) {
    if (before.kind !== "credits") throw new Error("PROFILE_RIGHT_SOURCE_UNAVAILABLE");
    change = {
      kind: "credit_adjust",
      sale_id: saleId,
      quantity: value.quantity,
      direction: value.direction,
    };
  } else {
    const T = await getTemporal();
    if (T.PlainDate.compare(value.endDate, before.end_date) <= 0)
      throw new z.ZodError([{ code: "custom", path: ["endDate"], message: "DATE_MUST_EXTEND" }]);
    change = { kind: "entitlement_extend", sale_id: saleId, end_date: value.endDate };
  }
  const backend = await scopedBackend(scope),
    preview = await backend.call("reservation_impact_preview_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      change,
      reason: value.reason,
    });
  const actual = preview.change;
  if (
    actual.kind !== change.kind ||
    !("sale_id" in actual) ||
    actual.sale_id !== saleId ||
    preview.preserves_reservations !== true ||
    preview.waives_independent_blocks !== false ||
    (change.kind === "credit_adjust" &&
      (actual.kind !== "credit_adjust" ||
        actual.quantity !== change.quantity ||
        actual.direction !== change.direction)) ||
    (change.kind === "entitlement_extend" &&
      (actual.kind !== "entitlement_extend" || actual.end_date !== change.end_date))
  )
    throw new Error("PROFILE_RIGHT_PREVIEW_UNAVAILABLE");
  z.uuid().parse(preview.preview.id);
  z.string().min(1).parse(preview.preview.token);
  z.iso.datetime({ offset: true }).parse(preview.preview.expires_at);
  const target =
    change.kind === "credit_adjust"
      ? { type: "entitlement_accounts", id: before.account_id }
      : { type: "sales", id: saleId };
  if (
    !preview.preview.effects.some(
      (x) => x.entity.type === target.type && x.entity.id === target.id && x.action === "adjust",
    )
  )
    throw new Error("PROFILE_RIGHT_PREVIEW_UNAVAILABLE");
  const ids = new Set<string>(),
    affected: RightReview["affected"] = [];
  for (const item of preview.affected) {
    z.uuid().parse(item.reservation_id);
    z.uuid().parse(item.session_id);
    if (
      item.person_id !== personId ||
      item.source_sale_id !== saleId ||
      ids.has(item.reservation_id)
    )
      throw new Error("PROFILE_RIGHT_PREVIEW_UNAVAILABLE");
    ids.add(item.reservation_id);
    const session = await backend.call("session_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      session_id: item.session_id,
    });
    if (session.id !== item.session_id) throw new Error("PROFILE_RIGHT_PREVIEW_UNAVAILABLE");
    z.iso.datetime({ offset: true }).parse(session.starts_at);
    affected.push({ id: item.reservation_id, startsAt: session.starts_at });
  }
  return {
    scope: { ...scope },
    personId,
    action,
    before,
    change,
    reason: value.reason,
    preview,
    affected,
  };
}
export type RightIntent = { scope: ClientScope; review: RightReview } & (
  | { operation: "credit_adjust_v1"; request: Omit<RequestCreditAdjust, "request_id"> }
  | { operation: "entitlement_extend_v1"; request: Omit<RequestEntitlementExtend, "request_id"> }
);
export function rightAdjustmentIntent(review: RightReview): RightIntent {
  if (review.preview.preview.blockers.length) throw new Error("PROFILE_RIGHT_BLOCKED");
  const common = {
    client_api_version: 1 as const,
    org_id: review.scope.orgId,
    center_id: review.scope.centerId,
    operation_key: uuidv7(),
    sale_id: review.before.sale_id,
    reason: review.reason,
    impact_approval: { id: review.preview.preview.id, token: review.preview.preview.token },
    accepted_reservation_ids: review.affected.map((x) => x.id),
  };
  const base = { scope: { ...review.scope }, review: structuredClone(review) };
  return review.change.kind === "credit_adjust"
    ? {
        ...base,
        operation: "credit_adjust_v1",
        request: {
          ...common,
          quantity: review.change.quantity,
          direction: review.change.direction,
        },
      }
    : {
        ...base,
        operation: "entitlement_extend_v1",
        request: {
          ...common,
          expected_version: review.before.version,
          end_date: review.change.end_date,
        },
      };
}
export async function writeRightAdjustment(intent: RightIntent) {
  const backend = await scopedBackend(intent.scope),
    request_id = uuidv7();
  const result =
    intent.operation === "credit_adjust_v1"
      ? await backend.call(intent.operation, { ...intent.request, request_id })
      : await backend.call(intent.operation, { ...intent.request, request_id });
  if (result.primary_id !== intent.review.before.account_id)
    throw new Error("PROFILE_RIGHT_RESULT_UNAVAILABLE");
  return result;
}
export async function readRightAdjustmentReceipt(intent: RightIntent) {
  const backend = await scopedBackend(intent.scope),
    result = await backend.call("operation_status_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: intent.scope.orgId,
      operation: intent.operation,
      key: intent.request.operation_key,
    });
  if (
    result.operation !== intent.operation ||
    result.key !== intent.request.operation_key ||
    (result.result_reference &&
      (result.result_reference.type !== "entitlement_accounts" ||
        result.result_reference.id !== intent.review.before.account_id))
  )
    throw new Error("PROFILE_RIGHT_RECEIPT_UNAVAILABLE");
  return result;
}
export async function readRightAdjustmentResult(intent: RightIntent, id?: string) {
  const { review, scope } = intent;
  if (id !== review.before.account_id) throw new Error("PROFILE_RIGHT_RESULT_UNAVAILABLE");
  const rights = await readProfileRights(scope, review.personId),
    row = rights.find((x) => x.sale_id === review.before.sale_id);
  if (
    !row ||
    row.account_id !== id ||
    !row.version ||
    row.version <= review.before.version ||
    (review.change.kind === "entitlement_extend" && row.end_date !== review.change.end_date)
  )
    throw new Error("PROFILE_RIGHT_RESULT_UNAVAILABLE");
  for (const item of review.preview.affected) {
    const row = await readProfileReservation(
      scope,
      review.personId,
      item.reservation_id,
      item.session_id,
    );
    if (row.state !== "active") throw new Error("PROFILE_RIGHT_RESULT_UNAVAILABLE");
  }
  return { rights };
}
export type RightAdjustmentResult = Awaited<ReturnType<typeof readRightAdjustmentResult>>;
