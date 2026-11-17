import { beforeEach, expect, it, vi } from "vitest";
import type {
  EntitlementView,
  ProductView,
  Preview,
  ManagementStateView,
} from "../../lib/api-contracts/generated";
const { call, readRights, readFinance } = vi.hoisted(() => ({
  call: vi.fn(),
  readRights: vi.fn(),
  readFinance: vi.fn(),
}));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
vi.mock("./profile-read", () => ({ readProfileRights: readRights }));
vi.mock("../finance/finance", () => ({ readFinancePage: readFinance }));
import {
  readSaleInventory,
  sameSaleInventory,
  previewSaleLifecycle,
  saleLifecycleIntent,
  readSaleLifecycleReceipt,
  readSaleLifecycleResult,
} from "./sale-lifecycle";
import { emptyMemberDraft } from "./member-draft";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) },
  personId = id(4);
const source: EntitlementView = {
  sale_id: id(5),
  person_id: personId,
  product_version_id: id(6),
  start_date: "2026-11-15",
  end_date: "2027-03-15",
  timezone: "Europe/Istanbul",
  state: "active",
  sale_state: "active",
  sale_version: 3,
  available: 7,
  reserved: 1,
  consumed: 0,
  deficit: 0,
  quotas: [],
  deficit_scopes: [],
};
const product: ProductView = {
  id: id(6),
  version_id: id(7),
  terms: {
    name: "Sentetik hedef paket",
    kind: "credits",
    booking_mode: "flexible",
    credits: 8,
    price_minor: "100000",
    currency: "TRY",
    freeze: { enabled: false, extends_validity: false },
    refund: { method: "credit_ratio" },
    quota: null,
    scopes: [
      {
        scope_kind: "center_all_disciplines",
        center_id: scope.centerId,
        discipline_id: null,
        usage_targets: ["lesson"],
      },
    ],
  },
};

function row(n: number): ManagementStateView {
  return {
    operation: "sale_change_preview_v1",
    entity: { type: "reservations", id: id(n) },
    exists: true,
    state: "active",
    as_of: "2026-11-16T10:00:00Z",
    current: { operation: "sale_change_preview_v1", values: { sale_id: source.sale_id } },
    versions: [
      { entity: { type: "sales", id: source.sale_id }, version: 3 },
      { entity: { type: "reservations", id: id(n) }, version: 2 },
      { entity: { type: "sessions", id: id(8) }, version: 4 },
    ],
    sale_change_record: {
      person_id: personId,
      center_id: scope.centerId,
      parent: { type: "sessions", id: id(8) },
      starts_at: "2027-01-20T16:00:00Z",
    },
  };
}
const draft = () => ({
  ...emptyMemberDraft(),
  productVersionId: product.version_id,
  startDate: "2027-01-15",
  endDate: "2027-02-15",
  reason: "Sentetik değişim",
});
function preview(): Preview {
  return {
    id: id(9),
    token: "synthetic",
    scope_hash: "synthetic",
    dependencies: {
      versions: [{ entity: { type: "sales", id: source.sale_id }, version: 3 }],
      policy_hashes: [],
      permission_hash: "synthetic",
    },
    effects: [],
    blockers: [],
    expires_at: "2099-01-01T00:00:00Z",
    sale_lifecycle: {
      previous_sale_id: source.sale_id,
      product_version_id: product.version_id,
      start_date: "2027-01-15",
      end_date: "2027-02-15",
      previous_end_date: source.end_date,
      gap_days: 0,
      overlap_days: 31,
      refund: null,
      offset_minor: "0",
    },
  };
}
beforeEach(() => {
  call.mockReset();
  readRights.mockReset();
  readFinance.mockReset();
});
it("reads every cursor page with one source version and rejects an unrelated source context", async () => {
  const context = { entity: { type: "sales", id: source.sale_id }, version: 3 };
  call
    .mockResolvedValueOnce({
      items: [row(10)],
      sale_change_context: context,
      as_of: "2026-11-16T10:00:00Z",
      next_cursor: "next",
    })
    .mockResolvedValueOnce({
      items: [row(11)],
      sale_change_context: context,
      as_of: "2026-11-16T10:00:01Z",
      next_cursor: null,
    });
  expect(
    (await readSaleInventory(scope, source.sale_id)).items.map((row) => row.entity!.id),
  ).toEqual([id(10), id(11)]);
  expect(call.mock.calls[1]![1].page.cursor).toBe("next");
  call.mockResolvedValue({
    items: [],
    sale_change_context: { ...context, entity: { type: "sales", id: id(20) } },
    as_of: "2026-11-16T10:00:00Z",
    next_cursor: null,
  });
  await expect(readSaleInventory(scope, source.sale_id)).rejects.toThrow("INVENTORY_UNAVAILABLE");
});
it("a source change during paging discards the partial inventory", async () => {
  const context = { entity: { type: "sales", id: source.sale_id }, version: 3 };
  call
    .mockResolvedValueOnce({
      items: [row(10)],
      sale_change_context: context,
      as_of: "2026-11-16T10:00:00Z",
      next_cursor: "next",
    })
    .mockResolvedValueOnce({
      items: [],
      sale_change_context: { ...context, version: 4 },
      as_of: "2026-11-16T10:00:01Z",
      next_cursor: null,
    });
  await expect(readSaleInventory(scope, source.sale_id)).rejects.toThrow("INVENTORY_UNAVAILABLE");
});
it("new evaluation time alone does not invalidate the reviewed bindings, but a reservation version does", () => {
  const first = { version: 3, items: [row(10)] },
    next = structuredClone(first);
  next.items[0]!.as_of = "2026-11-16T10:00:01Z";
  expect(sameSaleInventory(first, next)).toBe(true);
  next.items[0]!.versions[1]!.version++;
  expect(sameSaleInventory(first, next)).toBe(false);
});
it("change requires the entire explicit keep/cancel partition and refuses unresolved events before preview", async () => {
  const inventory = { version: 3, items: [row(10), row(11)] };
  await expect(
    previewSaleLifecycle(
      scope,
      personId,
      source,
      "change",
      { ...draft(), reservations: { [id(10)]: "keep" } },
      product,
      inventory,
    ),
  ).rejects.toThrow("CHOICES_REQUIRED");
  const event = row(12);
  event.entity = { type: "event_registrations", id: id(12) };
  await expect(
    previewSaleLifecycle(scope, personId, source, "change", draft(), product, {
      version: 3,
      items: [event],
    }),
  ).rejects.toThrow("INVENTORY_UNAVAILABLE");
  expect(call).not.toHaveBeenCalled();
});
it("renewal validates native previous-sale and target dates without calculating or carrying old rights", async () => {
  call.mockResolvedValue(preview());
  const review = await previewSaleLifecycle(scope, personId, source, "renew", draft(), product);
  expect(review.preview.sale_lifecycle!.overlap_days).toBe(31);
  expect(call.mock.lastCall![1]).toMatchObject({
    previous_sale_id: source.sale_id,
    product_version_id: product.version_id,
    start_date: "2027-01-15",
  });
  const mismatched = preview();
  mismatched.sale_lifecycle!.previous_sale_id = id(99);
  call.mockResolvedValue(mismatched);
  await expect(
    previewSaleLifecycle(scope, personId, source, "renew", draft(), product),
  ).rejects.toThrow("PREVIEW_UNAVAILABLE");
});
it("a blocked or expired preview cannot become an apply; receipt identity remains bound to the original operation", async () => {
  call.mockResolvedValue(preview());
  const review = await previewSaleLifecycle(scope, personId, source, "renew", draft(), product),
    intent = saleLifecycleIntent(review);
  review.preview.expires_at = "2020-01-01T00:00:00Z";
  expect(() => saleLifecycleIntent(review)).toThrow("STALE");
  call.mockResolvedValue({
    operation: "sale_change_apply_v1",
    key: intent.key,
    status: "succeeded",
    result_reference: { type: "sales", id: id(30) },
  });
  await expect(readSaleLifecycleReceipt(intent)).rejects.toThrow("RECEIPT_UNAVAILABLE");
});
it("termination confirms the known sale and protected reservations without reading unrelated finance", async () => {
  const value = preview();
  delete value.sale_lifecycle;
  value.effects = [
    { entity: { type: "sales", id: source.sale_id }, action: "close" },
    { entity: { type: "reservations", id: id(10) }, action: "adjust" },
  ];
  call.mockResolvedValueOnce(value);
  const review = await previewSaleLifecycle(scope, personId, source, "terminate", draft()),
    intent = saleLifecycleIntent(review);
  readRights.mockResolvedValue([
    { ...source, sale_state: "terminated", state: "closed", sale_version: 4, reserved: 1 },
  ]);
  call.mockResolvedValue({
    items: [{ exists: true, entity: { type: "reservations", id: id(10) }, state: "active" }],
    next_cursor: null,
  });
  await expect(readSaleLifecycleResult(intent, source.sale_id)).resolves.toMatchObject({
    rows: [{ reserved: 1 }],
  });
  expect(readFinance).not.toHaveBeenCalled();
  await expect(readSaleLifecycleResult(intent, id(99))).rejects.toThrow("RESULT_UNAVAILABLE");
});
