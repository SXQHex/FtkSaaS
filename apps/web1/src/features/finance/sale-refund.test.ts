import { beforeEach, expect, it, vi } from "vitest";
import type { Preview } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  readSaleRefundAuthority,
  previewSaleRefund,
  saleRefundIntent,
  writeSaleRefund,
  readSaleRefundReceipt,
  readSaleRefundResult,
} from "./sale-refund";
const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000002",
  orgId: "019a7b00-0000-7000-8000-000000000003",
  centerId: "019a7b00-0000-7000-8000-000000000004",
};
const source = {
  saleId: "019a7b00-0000-7000-8000-000000000008",
  personId: "019a7b00-0000-7000-8000-000000000006",
  currency: "TRY",
  label: "Synthetic sale",
};
const authority = () => ({
  items: [
    {
      exists: true,
      entity: { type: "sales", id: source.saleId },
      versions: [{ entity: { type: "sales", id: source.saleId }, version: 2 }],
      current: { operation: "sale_refund_preview_v1", values: { sale_id: source.saleId } },
    },
  ],
  next_cursor: null,
});
const preview = (): Preview => ({
  id: scope.accountId,
  token: "synthetic-preview",
  scope_hash: "synthetic",
  dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
  effects: [
    {
      entity: { type: "sales", id: source.saleId },
      action: "adjust",
      amount_minor: "10000",
      currency: "TRY",
    },
  ],
  blockers: [],
  expires_at: "2099-01-01T00:00:00Z",
});
beforeEach(() => call.mockReset());
it("reads exact sale authority before requesting a reason-only provider quote", async () => {
  call.mockImplementation(async (op) =>
    op === "management_state_get_v1" ? authority() : preview(),
  );
  const review = await previewSaleRefund(scope, source, " Synthetic reason ");
  expect(call.mock.calls.map((row) => row[0])).toEqual([
    "management_state_get_v1",
    "sale_refund_preview_v1",
  ]);
  expect(call.mock.calls[0][1].selector).toEqual({
    operation: "sale_refund_preview_v1",
    key: { sale_id: source.saleId },
  });
  expect(call.mock.calls[1][1]).toEqual({
    client_api_version: 1,
    request_id: expect.any(String),
    org_id: scope.orgId,
    center_id: scope.centerId,
    sale_id: source.saleId,
    reason: "Synthetic reason",
  });
  expect(review.reason).toBe("Synthetic reason");
});
it("rejects a cash movement presented as sale authority and a quote for another sale or currency", async () => {
  const page = authority();
  page.items[0].entity.type = "cash_movements";
  call.mockResolvedValue(page);
  await expect(readSaleRefundAuthority(scope, source.saleId)).rejects.toThrow(
    "SALE_REFUND_AUTHORITY_UNAVAILABLE",
  );
  const quote = preview();
  quote.effects[0].currency = "EUR";
  call.mockImplementation(async (op) => (op === "management_state_get_v1" ? authority() : quote));
  await expect(previewSaleRefund(scope, source, "Synthetic")).rejects.toThrow(
    "SALE_REFUND_PREVIEW_UNAVAILABLE",
  );
  quote.effects[0].currency = "TRY";
  quote.effects[0].entity.id = scope.accountId;
  await expect(previewSaleRefund(scope, source, "Synthetic")).rejects.toThrow(
    "SALE_REFUND_PREVIEW_UNAVAILABLE",
  );
});
it("preserves provider zero effects and a frozen capability, rejecting blockers and expiry", async () => {
  const quote = preview();
  quote.effects[0].amount_minor = "0";
  call.mockImplementation(async (op) => (op === "management_state_get_v1" ? authority() : quote));
  const review = await previewSaleRefund(scope, source, "Synthetic"),
    intent = saleRefundIntent(review);
  review.preview.token = "changed";
  expect(intent.request.preview.token).toBe("synthetic-preview");
  expect(intent.request).not.toHaveProperty("amount_minor");
  expect(intent.request).not.toHaveProperty("occurred_at");
  expect(intent.request).not.toHaveProperty("sale_id");
  review.preview.blockers = [{ code: "FORBIDDEN", retryable: false, trace_id: scope.accountId }];
  expect(() => saleRefundIntent(review)).toThrow();
  review.preview.blockers = [];
  review.preview.expires_at = "2000-01-01T00:00:00Z";
  expect(() => saleRefundIntent(review)).toThrow();
});
it("binds receipt to the exact operation/key while keeping the refund fact distinct from sale ID", async () => {
  const intent = saleRefundIntent({ scope, source, reason: "Synthetic", preview: preview() });
  call.mockResolvedValue({ primary_id: scope.centerId, changed: [], jobs: [] });
  await writeSaleRefund(intent);
  expect(call.mock.calls[0][1]).toMatchObject({
    operation_key: intent.request.operation_key,
    preview: intent.request.preview,
  });
  call.mockResolvedValue({
    operation: intent.operation,
    key: "other",
    status: "succeeded",
    result_reference: { type: "sales", id: scope.centerId },
  });
  await expect(readSaleRefundReceipt(intent)).rejects.toThrow("SALE_REFUND_RECEIPT_UNAVAILABLE");
  call.mockResolvedValue({
    operation: intent.operation,
    key: intent.request.operation_key,
    status: "succeeded",
    result_reference: { type: "sales", id: scope.centerId },
  });
  expect((await readSaleRefundReceipt(intent)).result_reference?.id).toBe(scope.centerId);
});
it("rereads current finance without inventing a refund cash movement or treating denied rights as zero", async () => {
  const intent = saleRefundIntent({ scope, source, reason: "Synthetic", preview: preview() });
  call.mockImplementation(async (op) => {
    if (op === "entitlements_get_v1")
      throw new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: scope.accountId });
    return {
      person_id: source.personId,
      currency: "TRY",
      credit_available_minor: "20000",
      debts: [],
      movements: { items: [], next_cursor: null, as_of: "2026-11-16T10:00:00Z" },
    };
  });
  const result = await readSaleRefundResult(intent, scope.centerId);
  expect(result.finance.credit_available_minor).toBe("20000");
  expect(result.rights).toBeUndefined();
  expect(result.finance.movements.items).toEqual([]);
});
