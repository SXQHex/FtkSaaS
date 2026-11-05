import { getSession } from "./api";
import { documentReadActions } from "./document-requirements";
import type {
  Preview,
  SalePreview,
  RequestSalePreview,
  RequestSaleRenewPreview,
} from "@ftksaas/api-contracts";
import { setupCall, type SetupScope } from "./studio-setup";
import { listProducts, readEntitlements } from "./products";
export type RenewalInput = Pick<
  RequestSaleRenewPreview,
  "previous_sale_id" | "product_version_id" | "start_date" | "end_date"
>;
export type SaleInput = Pick<
  RequestSalePreview,
  "person_id" | "product_version_id" | "start_date" | "end_date"
>;
export const salesApi = {
  session: getSession,
  salePreview: (scope: SetupScope, input: SaleInput) =>
    setupCall("sale_preview_v1", { org_id: scope.orgId, center_id: scope.centerId, ...input }),
  documents: documentReadActions,
  products: listProducts,
  rights: readEntitlements,
  preview: (scope: SetupScope, input: RenewalInput) =>
    setupCall("sale_renew_preview_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      ...input,
    }),
  finance: (scope: SetupScope, personId: string, currency: string) =>
    setupCall("finance_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
      currency,
      page: { limit: 25, sort: "created_at_asc" },
    }),
};
export type SalesApi = typeof salesApi;
export function renewalMatches(preview: Preview, input: RenewalInput) {
  const details = preview.sale_lifecycle;
  return (
    !!details &&
    Object.entries(input).every(([key, value]) => details[key as keyof RenewalInput] === value) &&
    preview.effects.some(
      (effect) => effect.entity.type === "sales" && effect.action === "create",
    ) &&
    preview.effects.every((effect) => effect.amount_minor == null || !!effect.currency) &&
    Date.parse(preview.expires_at) > Date.now()
  );
}

export function saleMatches(preview: SalePreview, input: SaleInput) {
  const sale = preview.sale;
  return (
    !!sale &&
    Object.entries(input).every(([key, value]) => sale[key as keyof SaleInput] === value) &&
    /^[A-Z]{3}$/.test(sale.currency) &&
    /^(0|[1-9][0-9]*)$/.test(sale.debt_minor) &&
    Number.isFinite(Date.parse(sale.valid_from)) &&
    Date.parse(sale.valid_until) > Date.parse(sale.valid_from) &&
    Date.parse(preview.expires_at) > Date.now()
  );
}
