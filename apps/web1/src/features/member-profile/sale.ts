import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  ProductView,
  RequestSalePreview,
  RequestSaleApply,
  SalePreview,
  EntitlementView,
  FinanceView,
} from "../../lib/api-contracts/generated";
import { getTemporal } from "../../lib/temporal";
import { readFinancePage } from "../finance/finance";
import { readProfileRights } from "./profile-read";
import type { MemberDraft } from "./member-draft";
export interface SaleReview {
  scope: ClientScope;
  personId: string;
  product: ProductView;
  request: Omit<RequestSalePreview, "request_id">;
  preview: SalePreview;
  collectAfterSale: boolean;
}
export interface SaleIntent {
  scope: ClientScope;
  review: SaleReview;
  operation: "sale_apply_v1";
  request: Omit<RequestSaleApply, "request_id">;
}
const money = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((v) => BigInt(v) <= 9223372036854775807n);
export async function previewSale(
  scope: ClientScope,
  personId: string,
  timezone: string,
  product: ProductView,
  draft: MemberDraft,
): Promise<SaleReview> {
  z.uuid().parse(personId);
  const value = z
    .object({
      productVersionId: z.uuid(),
      startDate: z.iso.date(),
      endDate: z.iso.date(),
      collectAfterSale: z.boolean(),
    })
    .parse(draft);
  if (value.productVersionId !== product.version_id)
    throw new Error("PROFILE_PRODUCT_SOURCE_UNAVAILABLE");
  const T = await getTemporal();
  T.PlainDate.from(value.startDate);
  T.PlainDate.from(value.endDate);
  const request: Omit<RequestSalePreview, "request_id"> = {
    client_api_version: 1,
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: personId,
    product_version_id: value.productVersionId,
    start_date: value.startDate,
    end_date: value.endDate,
  };
  const backend = await scopedBackend(scope),
    preview = await backend.call("sale_preview_v1", { ...request, request_id: uuidv7() });
  z.uuid().parse(preview.id);
  z.string().min(1).parse(preview.token);
  z.iso.datetime({ offset: true }).parse(preview.expires_at);
  const sale = preview.sale;
  if (
    sale.person_id !== personId ||
    sale.product_version_id !== product.version_id ||
    sale.start_date !== value.startDate ||
    sale.end_date !== value.endDate ||
    sale.timezone !== timezone ||
    sale.kind !== product.terms.kind ||
    sale.booking_mode !== product.terms.booking_mode ||
    sale.currency !== product.terms.currency
  )
    throw new Error("PROFILE_SALE_PREVIEW_UNAVAILABLE");
  money.parse(sale.debt_minor);
  z.iso.datetime({ offset: true }).parse(sale.valid_from);
  z.iso.datetime({ offset: true }).parse(sale.valid_until);
  if (Date.parse(sale.valid_from) >= Date.parse(sale.valid_until))
    throw new Error("PROFILE_SALE_PREVIEW_UNAVAILABLE");
  for (const n of [sale.granted, sale.reserved, sale.consumed, sale.available])
    z.number().int().nonnegative().safe().parse(n);
  if (sale.quota) z.number().int().positive().safe().parse(sale.quota.limit);
  for (const row of sale.deficits) {
    for (const id of [row.deficit_id, row.reservation_id, row.session_id]) z.uuid().parse(id);
    for (const v of [row.version, row.reservation_version, row.session_version])
      z.number().int().positive().safe().parse(v);
    z.number().int().nonnegative().safe().parse(row.quantity);
  }
  return {
    scope: { ...scope },
    personId,
    product: structuredClone(product),
    request,
    preview,
    collectAfterSale: value.collectAfterSale,
  };
}
export function saleIntent(review: SaleReview): SaleIntent {
  if (review.preview.blockers.length || Date.parse(review.preview.expires_at) <= Date.now())
    throw new Error("PROFILE_SALE_PREVIEW_STALE");
  return {
    scope: { ...review.scope },
    review: structuredClone(review),
    operation: "sale_apply_v1",
    request: {
      client_api_version: 1,
      org_id: review.scope.orgId,
      center_id: review.scope.centerId,
      operation_key: uuidv7(),
      preview: { id: review.preview.id, token: review.preview.token },
    },
  };
}
export async function writeSale(intent: SaleIntent) {
  const backend = await scopedBackend(intent.scope),
    result = await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  z.uuid().parse(result.primary_id);
  return result;
}
export async function readSaleReceipt(intent: SaleIntent) {
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
    (result.result_reference && result.result_reference.type !== "sales")
  )
    throw new Error("PROFILE_SALE_RECEIPT_UNAVAILABLE");
  return result;
}
export interface SaleResult {
  entitlements: EntitlementView[];
  entitlement: EntitlementView;
  finance: FinanceView;
}
export async function readSaleResult(intent: SaleIntent, id?: string): Promise<SaleResult> {
  z.uuid().parse(id);
  const projection = intent.review.preview.sale,
    rows = await readProfileRights(intent.scope, intent.review.personId),
    row = rows.find((x) => x.sale_id === id);
  if (
    !row ||
    row.product_version_id !== projection.product_version_id ||
    row.start_date !== projection.start_date ||
    row.end_date !== projection.end_date ||
    row.timezone !== projection.timezone ||
    row.kind !== projection.kind ||
    row.booking_mode !== projection.booking_mode ||
    !Number.isSafeInteger(row.sale_version) ||
    row.sale_version! < 1
  )
    throw new Error("PROFILE_SALE_RESULT_UNAVAILABLE");
  const finance = await readFinancePage(intent.scope, {
    personId: intent.review.personId,
    currency: projection.currency,
  });
  return { entitlements: rows, entitlement: row, finance };
}
