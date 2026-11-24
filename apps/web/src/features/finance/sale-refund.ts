import { readFinanceOperationReceipt } from "./finance-receipt";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { Preview, RequestSaleRefundApply } from "@ftksaas/api-contracts";
import { readFinancePage } from "./finance";
import { readProfileRights } from "../member-profile/profile-read";
export interface SaleRefundSource {
  saleId: string;
  personId: string;
  currency: string;
  label: string;
}
export interface SaleRefundReview {
  scope: ClientScope;
  source: SaleRefundSource;
  reason: string;
  preview: Preview;
}
export interface SaleRefundIntent {
  scope: ClientScope;
  review: SaleRefundReview;
  operation: "sale_refund_apply_v1";
  request: Omit<RequestSaleRefundApply, "request_id">;
}
export async function readSaleRefundAuthority(scope: ClientScope, saleId: string) {
  z.uuid().parse(saleId);
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "sale_refund_preview_v1",
    selector: { operation: "sale_refund_preview_v1", key: { sale_id: saleId } },
    page: { limit: 1 },
  });
  const item = page.items[0],
    versions =
      item?.versions.filter((row) => row.entity.type === "sales" && row.entity.id === saleId) ?? [];
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !item?.exists ||
    item.entity?.type !== "sales" ||
    item.entity.id !== saleId ||
    item.current?.operation !== "sale_refund_preview_v1" ||
    item.current.values.sale_id !== saleId ||
    versions.length !== 1
  )
    throw new Error("SALE_REFUND_AUTHORITY_UNAVAILABLE");
  return z.number().int().positive().safe().parse(versions[0].version);
}
export async function previewSaleRefund(
  scope: ClientScope,
  source: SaleRefundSource,
  reason: string,
): Promise<SaleRefundReview> {
  const value = z
      .object({
        saleId: z.uuid(),
        personId: z.uuid(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        label: z.string(),
      })
      .parse(source),
    why = z.string().trim().min(1).parse(reason);
  await readSaleRefundAuthority(scope, value.saleId);
  const backend = await scopedBackend(scope);
  const preview = await backend.call("sale_refund_preview_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    sale_id: value.saleId,
    reason: why,
  });
  z.uuid().parse(preview.id);
  z.string().min(1).parse(preview.token);
  z.iso.datetime({ offset: true }).parse(preview.expires_at);
  if (Date.parse(preview.expires_at) <= Date.now() || !preview.effects.length)
    throw new Error("SALE_REFUND_PREVIEW_UNAVAILABLE");
  for (const effect of preview.effects) {
    if (
      effect.entity.type !== "sales" ||
      effect.entity.id !== value.saleId ||
      effect.action !== "adjust" ||
      effect.currency !== value.currency
    )
      throw new Error("SALE_REFUND_PREVIEW_UNAVAILABLE");
    z.string()
      .regex(/^(0|[1-9][0-9]{0,18})$/)
      .refine((amount) => BigInt(amount) <= 9223372036854775807n)
      .parse(effect.amount_minor);
  }
  return { scope: { ...scope }, source: value, reason: why, preview };
}
export function saleRefundIntent(review: SaleRefundReview): SaleRefundIntent {
  if (review.preview.blockers.length || Date.parse(review.preview.expires_at) <= Date.now())
    throw new Error("SALE_REFUND_PREVIEW_UNAVAILABLE");
  return {
    scope: { ...review.scope },
    review: structuredClone(review),
    operation: "sale_refund_apply_v1",
    request: {
      client_api_version: 1,
      org_id: review.scope.orgId,
      center_id: review.scope.centerId,
      operation_key: uuidv7(),
      preview: { id: review.preview.id, token: review.preview.token },
    },
  };
}
export async function writeSaleRefund(intent: SaleRefundIntent) {
  const backend = await scopedBackend(intent.scope),
    result = await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  z.uuid().parse(result.primary_id);
  return result;
}
export function readSaleRefundReceipt(intent: SaleRefundIntent) {
  return readFinanceOperationReceipt(intent);
}
export async function readSaleRefundResult(intent: SaleRefundIntent, id?: string) {
  // The native ACK references a refund fact, not a new sale or a cash movement.
  z.uuid().parse(id);
  const source = intent.review.source;
  const finance = await readFinancePage(intent.scope, {
    personId: source.personId,
    currency: source.currency,
  });
  let rights;
  try {
    rights = await readProfileRights(intent.scope, source.personId);
  } catch (error) {
    if (
      !(
        error instanceof BackendError &&
        ["FORBIDDEN", "PLAN_FEATURE_UNAVAILABLE", "SUBSCRIPTION_RESTRICTED"].includes(error.code)
      )
    )
      throw error;
  }
  return { finance, rights };
}
export type SaleRefundResult = Awaited<ReturnType<typeof readSaleRefundResult>>;
