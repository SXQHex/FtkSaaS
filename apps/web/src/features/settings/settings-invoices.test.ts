import { beforeEach, expect, it, vi } from "vitest";
import { downloadInvoice, readBillingTax, readInvoicePage } from "./settings-invoices";
import type { PlatformInvoice } from "@ftksaas/api-contracts";

const { call, download } = vi.hoisted(() => ({ call: vi.fn(), download: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({
  scopedBackend: vi.fn(async () => ({ call, downloadInvoice: download })),
}));
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const row: PlatformInvoice = {
  id: id(4),
  invoice_number: "FTK-2026-001",
  issued_on: "2026-11-10",
  published_at: "2026-11-11T00:00:00Z",
  mime: "application/pdf",
  bytes: 4,
};
beforeEach(() => vi.resetAllMocks());

it("does not return a binary invoice with a different length or MIME", async () => {
  download.mockResolvedValueOnce(new Response("extra", { headers: { "content-type": row.mime } }));
  await expect(downloadInvoice(scope, row)).rejects.toThrow("BILLING_INVOICE_FILE_INVALID");
  download.mockResolvedValueOnce(
    new Response("text", { headers: { "content-type": "text/html" } }),
  );
  await expect(downloadInvoice(scope, row)).rejects.toThrow();
  expect(download).toHaveBeenCalledWith(
    expect.objectContaining({ org_id: scope.orgId, invoice_id: row.id }),
  );
});

it("rejects foreign tax data and circular invoice cursors", async () => {
  call.mockResolvedValueOnce({ org_id: id(5), version: 1, tax_office: null, tax_identifier: null });
  await expect(readBillingTax(scope)).rejects.toThrow("BILLING_TAX_SOURCE_INVALID");
  call.mockResolvedValueOnce({ items: [row], next_cursor: "same", as_of: row.published_at });
  await expect(readInvoicePage(scope, "same")).rejects.toThrow("BILLING_INVOICE_PAGE_INVALID");
});
