import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { platformInvoice } from "../../lib/invoice";
import { readEnvelope } from "../../lib/backend";
import type {
  OrganizationBillingTaxProfile,
  PlatformInvoice,
  RequestOrganizationBillingTaxSet,
} from "../../lib/api-contracts/generated";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";

const taxFields = z.object({
  tax_office: z.string().trim().min(1).max(200).nullable(),
  tax_identifier: z.string().trim().min(1).max(100).nullable(),
});
export type TaxFields = z.infer<typeof taxFields>;
const taxProfile = taxFields.extend({
  org_id: z.uuid(),
  version: z.number().int().nonnegative().safe(),
});
const pageSize = 50;
const invoicePage = z.object({
  items: z.array(platformInvoice).max(pageSize),
  next_cursor: z.string().min(1).nullable(),
  as_of: z.iso.datetime({ offset: true }),
});
const organizationRequest = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  request_id: uuidv7(),
});

export async function readBillingTax(scope: ClientScope) {
  const backend = await scopedBackend(scope);
  const profile = taxProfile.parse(
    await backend.call("organization_billing_tax_get_v1", organizationRequest(scope)),
  );
  if (
    profile.org_id !== scope.orgId ||
    (profile.version === 0 && (profile.tax_office !== null || profile.tax_identifier !== null))
  )
    throw Error("BILLING_TAX_SOURCE_INVALID");
  return profile;
}

export function billingTaxIntent(
  scope: ClientScope,
  before: OrganizationBillingTaxProfile,
  fields: TaxFields,
) {
  if (before.org_id !== scope.orgId) throw Error("BILLING_TAX_SOURCE_INVALID");
  return {
    scope: { ...scope },
    patch: {
      ...taxFields.parse(fields),
      operation_key: uuidv7(),
      expected_version: before.version,
    } satisfies Pick<
      RequestOrganizationBillingTaxSet,
      "tax_office" | "tax_identifier" | "operation_key" | "expected_version"
    >,
  };
}
export type BillingTaxIntent = ReturnType<typeof billingTaxIntent>;

export async function writeBillingTax(intent: BillingTaxIntent) {
  const backend = await scopedBackend(intent.scope);
  return backend.call("organization_billing_tax_set_v1", {
    ...organizationRequest(intent.scope),
    ...intent.patch,
  });
}

export async function readBillingTaxReceipt(intent: BillingTaxIntent) {
  const backend = await scopedBackend(intent.scope);
  const receipt = await backend.call("operation_status_get_v1", {
    ...organizationRequest(intent.scope),
    operation: "organization_billing_tax_set_v1",
    key: intent.patch.operation_key,
  });
  if (
    receipt.operation !== "organization_billing_tax_set_v1" ||
    receipt.key !== intent.patch.operation_key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== "organizations" ||
        receipt.result_reference.id !== intent.scope.orgId))
  )
    throw Error("BILLING_TAX_RECEIPT_INVALID");
  return receipt;
}

export async function readBillingTaxResult(intent: BillingTaxIntent, id?: string) {
  if (id && id !== intent.scope.orgId) throw Error("BILLING_TAX_RESULT_INVALID");
  const profile = await readBillingTax(intent.scope);
  if (
    profile.version <= intent.patch.expected_version ||
    profile.tax_office !== intent.patch.tax_office ||
    profile.tax_identifier !== intent.patch.tax_identifier
  )
    throw Error("BILLING_TAX_RESULT_INVALID");
  return profile;
}

export async function readInvoicePage(scope: ClientScope, cursor: string | null) {
  const backend = await scopedBackend(scope);
  const page = invoicePage.parse(
    await backend.call("organization_invoices_list_v1", {
      ...organizationRequest(scope),
      page: { limit: pageSize, ...(cursor ? { cursor } : {}) },
    }),
  );
  if (
    (cursor && page.next_cursor === cursor) ||
    new Set(page.items.map((row) => row.id)).size !== page.items.length
  )
    throw Error("BILLING_INVOICE_PAGE_INVALID");
  return page;
}

export async function downloadInvoice(scope: ClientScope, row: PlatformInvoice) {
  const file = platformInvoice.parse(row);
  const backend = await scopedBackend(scope);
  const response = await backend.downloadInvoice({
    ...organizationRequest(scope),
    invoice_id: file.id,
  });
  if (!response.ok || response.headers.get("content-type") !== file.mime) {
    await readEnvelope(response);
    throw Error("BILLING_INVOICE_FILE_INVALID");
  }
  const blob = await response.blob();
  if (blob.size !== file.bytes) throw Error("BILLING_INVOICE_FILE_INVALID");
  return { blob, name: `invoice-${file.id}.${file.mime === "application/zip" ? "zip" : "pdf"}` };
}
