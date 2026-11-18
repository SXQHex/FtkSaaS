import { beforeEach, expect, it, vi } from "vitest";
import type { ProductView, SalePreview, EntitlementView } from "../../lib/api-contracts/generated";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import { previewSale, saleIntent, writeSale, readSaleReceipt, readSaleResult } from "./sale";
import { readProfileRights, readProfileCatalog, readProfileDisciplines } from "./profile-read";
import { emptyMemberDraft } from "./member-draft";
const scope = {
    accountId: "019a7b00-0000-7000-8000-000000000002",
    orgId: "019a7b00-0000-7000-8000-000000000003",
    centerId: "019a7b00-0000-7000-8000-000000000004",
  },
  personId = "019a7b00-0000-7000-8000-000000000006",
  saleId = "019a7b00-0000-7000-8000-000000000070",
  previewId = "019a7b00-0000-7000-8000-000000000071";
const product: ProductView = {
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
        scope_kind: "center_all_disciplines",
        discipline_id: null,
        center_id: scope.centerId,
        usage_targets: ["lesson"],
      },
    ],
  },
};
const draft = () => ({
  ...emptyMemberDraft(),
  productVersionId: product.version_id,
  startDate: "2026-11-15",
  endDate: "2026-11-22",
});
const preview = (): SalePreview => ({
  id: previewId,
  token: "synthetic-capability",
  scope_hash: "synthetic",
  dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
  effects: [],
  blockers: [],
  expires_at: "2099-01-01T00:00:00Z",
  sale: {
    person_id: personId,
    product_version_id: product.version_id,
    kind: "credits",
    booking_mode: "flexible",
    start_date: "2026-11-15",
    end_date: "2026-11-22",
    timezone: "Europe/Istanbul",
    valid_from: "2026-11-14T21:00:00Z",
    valid_until: "2026-11-22T21:00:00Z",
    debt_minor: "9007199254740993",
    currency: "TRY",
    granted: 8,
    available: 8,
    reserved: 0,
    consumed: 0,
    quota: null,
    deficits: [],
  },
});
const entitlement = (): EntitlementView => ({
  sale_id: saleId,
  person_id: personId,
  product_version_id: product.version_id,
  start_date: "2026-11-15",
  end_date: "2026-11-22",
  timezone: "Europe/Istanbul",
  state: "active",
  kind: "credits",
  booking_mode: "flexible",
  available: 8,
  reserved: 0,
  consumed: 0,
  deficit: 0,
  deficit_scopes: [],
  quotas: [],
  version: 1,
  sale_version: 1,
});
beforeEach(() => call.mockReset());
it("uses native plain dates, exact immutable version and exact money without collecting payment", async () => {
  call.mockResolvedValue(preview());
  const review = await previewSale(scope, personId, "Europe/Istanbul", product, draft());
  expect(review.preview.sale.debt_minor).toBe("9007199254740993");
  expect(call.mock.calls[0]![1]).toMatchObject({
    person_id: personId,
    product_version_id: product.version_id,
    start_date: "2026-11-15",
    end_date: "2026-11-22",
  });
  for (const key of ["payment", "net_minor", "operation_key"])
    expect(call.mock.calls[0]![1]).not.toHaveProperty(key);
  await expect(
    previewSale(scope, personId, "Europe/Istanbul", product, { ...draft(), endDate: "2026-02-30" }),
  ).rejects.toThrow();
});
it("rejects a preview bound to a different person, currency, version or center timezone", async () => {
  for (const change of [
    { person_id: saleId },
    { currency: "USD" },
    { product_version_id: saleId },
    { timezone: "UTC" },
  ]) {
    const value = preview();
    Object.assign(value.sale, change);
    call.mockResolvedValue(value);
    await expect(previewSale(scope, personId, "Europe/Istanbul", product, draft())).rejects.toThrow(
      "PROFILE_SALE_PREVIEW_UNAVAILABLE",
    );
  }
});
it("blockers and expiry cannot turn into an apply capability", async () => {
  const p = preview();
  p.blockers = [{ code: "DOCUMENT_REQUIRED", retryable: false, trace_id: previewId }];
  call.mockResolvedValue(p);
  const review = await previewSale(scope, personId, "Europe/Istanbul", product, draft());
  expect(() => saleIntent(review)).toThrow("PROFILE_SALE_PREVIEW_STALE");
  review.preview.blockers = [];
  review.preview.expires_at = "2000-01-01T00:00:00Z";
  expect(() => saleIntent(review)).toThrow("PROFILE_SALE_PREVIEW_STALE");
});
it("retries only the frozen reviewed key/capability with new technical request IDs", async () => {
  call.mockResolvedValue(preview());
  const intent = saleIntent(
    await previewSale(scope, personId, "Europe/Istanbul", product, draft()),
  );
  call.mockReset();
  call.mockResolvedValue({ primary_id: saleId });
  await writeSale(intent);
  await writeSale(intent);
  const a = call.mock.calls[0]![1],
    b = call.mock.calls[1]![1];
  expect(a.request_id).not.toBe(b.request_id);
  expect({ ...a, request_id: null }).toEqual({ ...b, request_id: null });
  expect(a.preview).toEqual({ id: previewId, token: "synthetic-capability" });
});
it("requires a sales receipt rather than treating the product-version identity as a sale", async () => {
  call.mockResolvedValue(preview());
  const intent = saleIntent(
    await previewSale(scope, personId, "Europe/Istanbul", product, draft()),
  );
  call.mockResolvedValue({
    operation: intent.operation,
    key: intent.request.operation_key,
    result_reference: { type: "product_versions", id: product.version_id },
  });
  await expect(readSaleReceipt(intent)).rejects.toThrow("PROFILE_SALE_RECEIPT_UNAVAILABLE");
});
it("reads the canonical entitlement array, rejects scope/duplicate IDs and keeps current counts", async () => {
  call.mockResolvedValue([entitlement()]);
  expect(await readProfileRights(scope, personId)).toHaveLength(1);
  call.mockResolvedValue([{ ...entitlement(), person_id: saleId }]);
  await expect(readProfileRights(scope, personId)).rejects.toThrow(
    "PROFILE_RIGHTS_SOURCE_UNAVAILABLE",
  );
  call.mockResolvedValue([entitlement(), entitlement()]);
  await expect(readProfileRights(scope, personId)).rejects.toThrow(
    "PROFILE_RIGHTS_SOURCE_UNAVAILABLE",
  );
});
it("rereads the actual new sale and native finance without rewriting live consumption to preview counts", async () => {
  call.mockResolvedValue(preview());
  const intent = saleIntent(
    await previewSale(scope, personId, "Europe/Istanbul", product, draft()),
  );
  const actual = { ...entitlement(), available: 7, consumed: 1 };
  const finance = {
    person_id: personId,
    currency: "TRY",
    debts: [],
    credit_available_minor: "0",
    movements: { items: [], next_cursor: null, as_of: "2026-11-15T13:00:00Z" },
  };
  call.mockResolvedValueOnce([actual]).mockResolvedValueOnce(finance);
  const result = await readSaleResult(intent, saleId);
  expect(result.entitlement.available).toBe(7);
  expect(result.entitlements).toEqual([actual]);
  expect(result.finance).toEqual(finance);
  call.mockResolvedValue([{ ...actual, product_version_id: previewId }]);
  await expect(readSaleResult(intent, saleId)).rejects.toThrow("PROFILE_SALE_RESULT_UNAVAILABLE");
});

it("keeps every native catalog cursor page instead of iterating the empty accumulator", async () => {
  const other = { ...product, id: saleId, version_id: previewId };
  call
    .mockResolvedValueOnce({ items: [product], next_cursor: "next", as_of: "2026-11-15T13:00:00Z" })
    .mockResolvedValueOnce({ items: [other], next_cursor: null, as_of: "2026-11-15T13:00:00Z" });
  expect(await readProfileCatalog(scope)).toEqual([product, other]);
  expect(call.mock.calls[1]![1].page.cursor).toBe("next");
});

it("keeps explicit net price exact including zero and rejects malformed or int64-overflow before native preview", async () => {
  for (const netMinor of ["0", "75000", "9007199254740993", "9223372036854775807"]) {
    const projected = preview();
    projected.sale.debt_minor = netMinor;
    call.mockResolvedValue(projected);
    const review = await previewSale(scope, personId, "Europe/Istanbul", product, {
      ...draft(),
      netMinor,
    });
    expect(review.request.net_minor).toBe(netMinor);
    expect(review.preview.sale.debt_minor).toBe(netMinor);
    expect(call.mock.lastCall![1].net_minor).toBe(netMinor);
  }
  call.mockClear();
  for (const netMinor of ["-1", "1.5", "01", " ", "1e3", "9223372036854775808"]) {
    await expect(
      previewSale(scope, personId, "Europe/Istanbul", product, { ...draft(), netMinor }),
    ).rejects.toThrow();
  }
  expect(call).not.toHaveBeenCalled();
});

it("rejects a native projection that silently ignores the explicitly requested net price", async () => {
  call.mockResolvedValue(preview());
  await expect(
    previewSale(scope, personId, "Europe/Istanbul", product, { ...draft(), netMinor: "75000" }),
  ).rejects.toThrow("PROFILE_SALE_PREVIEW_UNAVAILABLE");
});

it("reads native discipline name cursor pages and rejects a repeated cursor rather than looping", async () => {
  const a = { id: saleId, name: "Sentetik A", state: "active", version: 1 },
    b = { ...a, id: previewId, name: "Sentetik B" };
  call
    .mockResolvedValueOnce({ items: [a], next_cursor: "next" })
    .mockResolvedValueOnce({ items: [b], next_cursor: null });
  expect(await readProfileDisciplines(scope)).toEqual([a, b]);
  expect(call.mock.calls[1]![1]).toMatchObject({
    org_id: scope.orgId,
    center_id: scope.centerId,
    page: { cursor: "next" },
  });
  call
    .mockResolvedValueOnce({ items: [a], next_cursor: "repeat" })
    .mockResolvedValueOnce({ items: [b], next_cursor: "repeat" });
  await expect(readProfileDisciplines(scope)).rejects.toThrow(
    "PROFILE_DISCIPLINE_SOURCE_UNAVAILABLE",
  );
});

it("continues only the original document purchase and applies its final preview after a fresh confirmation", async () => {
  const first = preview();
  first.blockers = [{ code: "DOCUMENT_REQUIRED", retryable: false, trace_id: personId }];
  call.mockResolvedValue(first);
  const a = await previewSale(scope, personId, "Europe/Istanbul", product, draft());
  const second = {
    ...preview(),
    id: "019a7b00-0000-7000-8000-000000000072",
    token: "synthetic-final",
  };
  call.mockResolvedValue(second);
  const b = await previewSale(scope, personId, "Europe/Istanbul", product, draft(), a);
  expect(call.mock.calls.at(-1)![1].document_purchase_id).toBe(first.id);
  expect(b.purchase).toEqual(a.purchase);
  expect(saleIntent(b).request.preview).toEqual({ id: second.id, token: second.token });
  call.mockResolvedValue({ ...second, id: "019a7b00-0000-7000-8000-000000000073" });
  const c = await previewSale(
    scope,
    personId,
    "Europe/Istanbul",
    product,
    { ...draft(), collectAfterSale: true },
    b,
  );
  expect(call.mock.calls.at(-1)![1].document_purchase_id).toBe(first.id);
  expect(c.purchase.id).toBe(first.id);
  expect(c.collectAfterSale).toBe(true);
});
it("does not reuse document consent for a different actor, organization, center, person or purchase parameter", async () => {
  call.mockResolvedValue(preview());
  const original = await previewSale(scope, personId, "Europe/Istanbul", product, draft());
  const changedScopes = [
    { ...scope, accountId: "019a7b00-0000-7000-8000-000000000091" },
    { ...scope, orgId: "019a7b00-0000-7000-8000-000000000092" },
    { ...scope, centerId: "019a7b00-0000-7000-8000-000000000093" },
  ];
  for (const target of changedScopes) {
    await previewSale(target, personId, "Europe/Istanbul", product, draft(), original);
    expect(call.mock.calls.at(-1)![1]).not.toHaveProperty("document_purchase_id");
  }
  const changes: {
    personId?: string;
    endDate?: string;
    netMinor?: string;
    productVersionId?: string;
  }[] = [
    { personId: "019a7b00-0000-7000-8000-000000000094" },
    { endDate: "2026-11-23" },
    { netMinor: "12345" },
    { productVersionId: "019a7b00-0000-7000-8000-000000000095" },
  ];
  for (const change of changes) {
    const next = preview();
    if (change.personId) next.sale.person_id = change.personId;
    if (change.endDate) {
      next.sale.end_date = change.endDate;
      next.sale.valid_until = change.endDate + "T21:00:00Z";
    }
    if (change.netMinor) next.sale.debt_minor = change.netMinor;
    if (change.productVersionId) next.sale.product_version_id = change.productVersionId;
    call.mockResolvedValue(next);
    const nextDraft = {
      ...draft(),
      ...(change.endDate ? { endDate: change.endDate } : {}),
      ...(change.netMinor ? { netMinor: change.netMinor } : {}),
      ...(change.productVersionId ? { productVersionId: change.productVersionId } : {}),
    };
    await previewSale(
      scope,
      change.personId ?? personId,
      "Europe/Istanbul",
      { ...product, version_id: change.productVersionId ?? product.version_id },
      nextDraft,
      original,
    );
    expect(call.mock.calls.at(-1)![1]).not.toHaveProperty("document_purchase_id");
  }
});
it("preserves the original purchase deadline rather than extending it with later preview responses", async () => {
  call.mockResolvedValue(preview());
  const a = await previewSale(scope, personId, "Europe/Istanbul", product, draft());
  a.purchase.expiresAt = "2000-01-01T00:00:00Z";
  expect(() => saleIntent(a)).toThrow("PROFILE_SALE_PREVIEW_STALE");
  const b = await previewSale(scope, personId, "Europe/Istanbul", product, draft(), a);
  expect(call.mock.calls.at(-1)![1]).not.toHaveProperty("document_purchase_id");
  expect(b.purchase.expiresAt).toBe(b.preview.expires_at);
});
