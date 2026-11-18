import { test, expect } from "./test.js";
import { mockMemberLifecycle, lifecycleIds as R } from "./member-lifecycle-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import type {
  RequestSalePreview,
  RequestSaleApply,
  SalePreview,
} from "../src/lib/api-contracts/generated.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
async function setup(page: import("@playwright/test").Page) {
  const f = await mockMemberLifecycle(page);
  const previews: RequestSalePreview[] = [],
    writes: RequestSaleApply[] = [];
  const state = { acceptedPurchase: undefined as string | undefined, failRecheck: false };
  const snapshots = new Map<string, SalePreview>();
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "finance_get_v1" && writes.length)
      return send({
        person_id: I.instructor,
        currency: "TRY",
        credit_available_minor: "0",
        debts: [R.debt, id(891)].map((id) => ({
          id,
          remaining_minor: "100000",
          due_at: "2027-01-15T00:00:00Z",
          center_id: I.center,
          version: 1,
        })),
        movements: { items: [], next_cursor: null, as_of: "2026-11-16T12:00:00Z" },
      });
    if (op === "sale_preview_v1") {
      previews.push(r);
      expect(r).toMatchObject({
        org_id: I.org,
        center_id: I.center,
        person_id: I.instructor,
        product_version_id: R.version,
        start_date: "2026-11-15",
      });
      if (state.failRecheck && r.document_purchase_id)
        return route.fulfill({
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
      const value: SalePreview = {
        id: id(800 + previews.length),
        token: `synthetic-preview-${previews.length}`,
        scope_hash: "synthetic-purchase-scope",
        dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
        effects: [],
        blockers:
          r.document_purchase_id && state.acceptedPurchase === r.document_purchase_id
            ? []
            : [{ code: "DOCUMENT_REQUIRED", retryable: false, trace_id: I.role }],
        expires_at: "2099-01-01T00:00:00Z",
        sale: {
          person_id: I.instructor,
          product_version_id: R.version,
          kind: "credits",
          booking_mode: "flexible",
          start_date: r.start_date,
          end_date: r.end_date,
          timezone: "Europe/Istanbul",
          valid_from: "2026-11-14T21:00:00Z",
          valid_until: r.end_date + "T21:00:00Z",
          debt_minor: "100000",
          currency: "TRY",
          granted: 8,
          available: 8,
          reserved: 0,
          consumed: 0,
          quota: null,
          deficits: [],
        },
      };
      snapshots.set(value.id, value);
      return send(value);
    }
    if (op === "sale_apply_v1") {
      writes.push(r);
      const value = snapshots.get(r.preview.id)!;
      expect(value.blockers).toEqual([]);
      expect(r.preview.token).toBe(value.token);
      f.rights.push({
        ...structuredClone(f.rights[0]!),
        sale_id: id(890),
        product_version_id: R.version,
        start_date: value.sale.start_date,
        end_date: value.sale.end_date,
        available: 8,
        reserved: 0,
        consumed: 0,
        version: 1,
        sale_version: 1,
      });
      return send({ primary_id: id(890), changed: [], jobs: [] });
    }
    return route.fallback();
  });
  await page.getByRole("button", { name: "Paket / hak tahsis et", exact: true }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("radio", { name: "Yeni 8 ders", exact: true }).press("Space");
  await panel.getByLabel("Başlangıç", { exact: true }).fill("2026-11-15");
  await panel.getByLabel("Bitiş", { exact: true }).fill("2026-11-22");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    panel.getByText(common.memberProfile.saleDocumentRequired, { exact: true }),
  ).toBeVisible();
  return { ...f, panel, previews, writes, state, snapshots };
}
test("document review resumes the original purchase across repeated checks and requires a fresh sale confirmation", async ({
  page,
}) => {
  const f = await setup(page);
  const first = id(801);
  expect(f.previews[0]).not.toHaveProperty("document_purchase_id");
  await expect(f.panel.getByRole("button", { name: "Uygula", exact: true })).toBeDisabled();
  await f.panel
    .getByRole("button", { name: common.memberProfile.saleRecheckDocuments, exact: true })
    .click();
  await expect.poll(() => f.previews.length).toBe(2);
  await expect(
    f.panel.getByText(common.memberProfile.saleDocumentRequired, { exact: true }),
  ).toBeVisible();
  expect(f.previews[1]!.document_purchase_id).toBe(first);
  expect(f.writes).toHaveLength(0);
  // Models the member's separately scoped native document acceptance. The member UI
  // and real actor/purchase isolation have their own document-context/native suites.
  f.state.acceptedPurchase = first;
  await f.panel
    .getByRole("button", { name: common.memberProfile.saleRecheckDocuments, exact: true })
    .click();
  await expect.poll(() => f.previews.length).toBe(3);
  await expect(
    f.panel.getByText(common.memberProfile.saleDocumentRequired, { exact: true }),
  ).toHaveCount(0);
  expect(f.previews[2]!.document_purchase_id).toBe(first);
  const consent = f.panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true });
  await expect(consent).not.toBeChecked();
  await expect(f.panel.getByRole("button", { name: "Uygula", exact: true })).toBeDisabled();
  expect(f.writes).toHaveLength(0);
  await consent.press("Space");
  await f.panel.getByRole("button", { name: "Uygula", exact: true }).click();
  await expect(
    f.panel.getByText("Satış ve güncel hak/finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]!.preview).toEqual({ id: id(803), token: "synthetic-preview-3" });
  expect(f.rights).toHaveLength(2);
});
test("editing a purchase never carries another date's document acceptance into the next preview", async ({
  page,
}) => {
  const f = await setup(page);
  f.state.acceptedPurchase = id(801);
  await f.panel.getByRole("button", { name: "Geri", exact: true }).click();
  await f.panel.getByLabel("Bitiş", { exact: true }).fill("2026-11-23");
  await f.panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    f.panel.getByText(common.memberProfile.saleDocumentRequired, { exact: true }),
  ).toBeVisible();
  expect(f.previews).toHaveLength(2);
  expect(f.previews[1]).not.toHaveProperty("document_purchase_id");
  expect(f.previews[1]!.end_date).toBe("2026-11-23");
  await expect(f.panel.getByRole("button", { name: "Uygula", exact: true })).toBeDisabled();
  expect(f.writes).toHaveLength(0);
});
test("a failed document recheck discards the old sale review and cannot expose an apply action", async ({
  page,
}) => {
  const f = await setup(page);
  f.state.failRecheck = true;
  await f.panel
    .getByRole("button", { name: common.memberProfile.saleRecheckDocuments, exact: true })
    .click();
  await expect(
    f.panel.getByText(common.memberProfile.saleAuthorityUnavailable, { exact: true }),
  ).toBeVisible();
  await expect(f.panel.getByRole("button", { name: "Uygula", exact: true })).toHaveCount(0);
  expect(f.writes).toHaveLength(0);
});
