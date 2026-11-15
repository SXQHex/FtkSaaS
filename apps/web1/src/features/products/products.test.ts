import { beforeEach, expect, it, vi } from "vitest";
import type { ProductView } from "../../lib/api-contracts/generated";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  productDraft,
  productIntent,
  writeProduct,
  readProductResult,
  readProductsPage,
  readProductReceipt,
  productTermsEqual,
} from "./products";
const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000002",
  orgId: "019a7b00-0000-7000-8000-000000000003",
  centerId: "019a7b00-0000-7000-8000-000000000004",
};
const base: ProductView = {
  id: "019a7b00-0000-7000-8000-000000000021",
  version_id: "019a7b00-0000-7000-8000-000000000022",
  terms: {
    name: "Sentetik paket",
    kind: "credits",
    booking_mode: "flexible",
    credits: 8,
    price_minor: "9007199254740993",
    currency: "TRY",
    freeze: { enabled: false, extends_validity: false },
    refund: { method: "credit_ratio" },
    quota: null,
    scopes: [
      {
        scope_kind: "center_discipline",
        center_id: scope.centerId,
        discipline_id: "019a7b00-0000-7000-8000-000000000009",
        class_id: "019a7b00-0000-7000-8000-000000000008",
        usage_targets: ["lesson"],
      },
    ],
  },
};
beforeEach(() => call.mockReset());
it("preserves exact minor money and narrow existing scopes without broadening to the selected center", () => {
  const draft = productDraft(base);
  draft.scopes = ["event"];
  draft.disciplineId = "";
  draft.scopeKind = "center_all_disciplines";
  const intent = productIntent(scope, draft, base);
  base.terms.scopes[0]!.usage_targets.push("event");
  expect(intent.request.terms.price_minor).toBe("9007199254740993");
  expect(intent.request.terms.scopes[0]).toMatchObject({
    scope_kind: "center_discipline",
    class_id: "019a7b00-0000-7000-8000-000000000008",
    usage_targets: ["lesson"],
  });
  base.terms.scopes[0]!.usage_targets.pop();
});
it("requires explicit new terms and a native scope and never copies drawing defaults", () => {
  const draft = productDraft();
  expect(draft.price).toBe("");
  expect(draft.credits).toBe("");
  expect(draft.currency).toBe("");
  expect(() => productIntent(scope, draft)).toThrow();
  Object.assign(draft, {
    name: "Yeni",
    kind: "timed",
    bookingMode: "flexible",
    refundMethod: "time_ratio",
    price: "0",
    currency: "TRY",
    scopeKind: "center_discipline",
    disciplineId: base.terms.scopes[0]!.discipline_id,
    scopes: ["lesson"],
    quotaPeriod: "week",
    quotaLimit: "2",
  });
  expect(() => productIntent(scope, draft)).toThrow("PRODUCT_SCOPE_REQUIRED");
  const intent = productIntent(scope, draft, undefined, [draft.disciplineId]);
  expect(intent.request.terms).toMatchObject({
    kind: "timed",
    credits: null,
    quota: { period: "week", limit: 2 },
  });
  draft.price = "9223372036854775808";
  expect(() => productIntent(scope, draft, undefined, [draft.disciplineId])).toThrow();
});
it("uses one frozen publish key for retries, fresh request IDs, and no nonexistent preview or version field", async () => {
  const intent = productIntent(scope, productDraft(base), base);
  call.mockResolvedValue({ primary_id: base.version_id });
  await writeProduct(intent);
  await writeProduct(intent);
  expect(call.mock.calls.map(([operation]) => operation)).toEqual([
    "product_publish_v1",
    "product_publish_v1",
  ]);
  const first = call.mock.calls[0]![1],
    second = call.mock.calls[1]![1];
  expect(first.operation_key).toBe(second.operation_key);
  expect(first.request_id).not.toBe(second.request_id);
  expect(first).not.toHaveProperty("preview");
  expect(first).not.toHaveProperty("expected_version");
  expect(first).not.toHaveProperty("validityDays");
});
it("reads the exact acknowledged version across native cursors and rejects a wrong product or receipt kind", async () => {
  const intent = productIntent(scope, productDraft(base), base);
  call
    .mockResolvedValueOnce({ items: [], next_cursor: "native-next" })
    .mockResolvedValueOnce({ items: [base], next_cursor: null });
  expect(await readProductResult(intent, base.version_id)).toEqual(base);
  expect(call.mock.calls[1]![1].page.cursor).toBe("native-next");
  call.mockResolvedValue({ items: [{ ...base, id: scope.accountId }], next_cursor: null });
  await expect(readProductResult(intent, base.version_id)).rejects.toThrow(
    "PRODUCT_RESULT_UNAVAILABLE",
  );
  call.mockResolvedValue({
    operation: intent.operation,
    key: intent.request.operation_key,
    result_reference: { type: "sales", id: base.version_id },
  });
  await expect(readProductReceipt(intent)).rejects.toThrow("PRODUCT_RECEIPT_UNAVAILABLE");
});
it("keeps the product reader native and cursor-bound, without invented status or query fields", async () => {
  call.mockResolvedValue({ items: [base], next_cursor: null });
  await readProductsPage(scope, "cursor-one");
  expect(call.mock.calls[0]).toEqual([
    "products_list_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      include_timed_products: true,
      page: { limit: 20, cursor: "cursor-one" },
    }),
  ]);
  expect(call.mock.calls[0]![1]).not.toHaveProperty("query");
  expect(call.mock.calls[0]![1]).not.toHaveProperty("status");
});

it("compares every native term while accepting optional null projection members", () => {
  const value = structuredClone(base.terms);
  value.freeze.max_days = null;
  value.refund.used_unit_minor = null;
  value.scopes[0]!.event_id = null;
  expect(productTermsEqual(value, base.terms)).toBe(true);
  value.booking_mode = "priority";
  expect(productTermsEqual(value, base.terms)).toBe(false);
  value.booking_mode = base.terms.booking_mode;
  value.scopes[0]!.usage_targets = ["event"];
  expect(productTermsEqual(value, base.terms)).toBe(false);
});

it("compares quota values independently of JSON object member order", () => {
  const left = {
    ...structuredClone(base.terms),
    kind: "timed" as const,
    credits: null,
    quota: { period: "week" as const, limit: 2 },
  };
  const right = { ...structuredClone(left), quota: { limit: 2, period: "week" as const } };
  expect(productTermsEqual(left, right)).toBe(true);
  right.quota.limit = 3;
  expect(productTermsEqual(left, right)).toBe(false);
});
