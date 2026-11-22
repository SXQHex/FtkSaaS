import { test, expect } from "./test.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
const copy = common.finance;
import type { Page } from "@playwright/test";
import { mockFinanceDirectory } from "./finance-directory-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { scanAccessibility } from "./accessibility.js";
async function setup(
  page: Page,
  options: { denied?: boolean; unknown?: boolean; unread?: boolean; prefillPage2?: boolean } = {},
) {
  const state = await mockFinanceDirectory(page),
    writes: Record<string, any>[] = [],
    previews: Record<string, any>[] = [],
    receipts: Record<string, any>[] = [];
  let refunded = false,
    financialReads = 0;
  const previewId = I.account,
    factId = I.availability;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON(),
      send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      fail = (code: string) =>
        route.fulfill({
          json: {
            ok: false,
            error: { code, retryable: code === "TEMPORARY_FAILURE", trace_id: I.role },
          },
        });
    if (op === "management_state_get_v1" && req.operation === "sale_refund_preview_v1") {
      expect(req.selector).toEqual({
        operation: "sale_refund_preview_v1",
        key: { sale_id: I.lesson },
      });
      if (options.denied) return fail("FORBIDDEN");
      return send({
        items: [
          {
            exists: true,
            operation: req.operation,
            entity: { type: "sales", id: I.lesson },
            state: "active",
            versions: [{ entity: { type: "sales", id: I.lesson }, version: 2 }],
            current: { operation: req.operation, values: { sale_id: I.lesson } },
          },
        ],
        next_cursor: null,
        as_of: "2026-11-16T10:00:00Z",
      });
    }
    if (op === "sale_refund_preview_v1") {
      previews.push(req);
      expect(req.sale_id).toBe(I.lesson);
      expect(req.reason).toBe("Sentetik satış iadesi");
      expect(req).not.toHaveProperty("amount_minor");
      expect(req).not.toHaveProperty("occurred_at");
      return send({
        id: previewId,
        token: "synthetic-sale-refund-capability",
        scope_hash: "synthetic",
        dependencies: {
          versions: [{ entity: { type: "sales", id: I.lesson }, version: 2 }],
          policy_hashes: [],
          permission_hash: "synthetic",
        },
        effects: [
          {
            entity: { type: "sales", id: I.lesson },
            action: "adjust",
            amount_minor: "10000",
            currency: "TRY",
          },
        ],
        blockers: [],
        expires_at: "2099-01-01T00:00:00Z",
      });
    }
    if (op === "sale_refund_apply_v1") {
      writes.push(req);
      expect(req.org_id).toBe(I.org);
      expect(req.center_id).toBe(I.center);
      expect(req.preview).toEqual({ id: previewId, token: "synthetic-sale-refund-capability" });
      expect(req).not.toHaveProperty("sale_id");
      expect(req).not.toHaveProperty("amount_minor");
      expect(req).not.toHaveProperty("occurred_at");
      if (writes.length > 1) expect(req.operation_key).toBe(writes[0].operation_key);
      refunded = true;
      state.totals[0].debt_minor = "50000";
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({ primary_id: factId, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1") {
      receipts.push(req);
      expect(req.operation).toBe("sale_refund_apply_v1");
      expect(req.key).toBe(writes[0].operation_key);
      return fail("TEMPORARY_FAILURE");
    }
    if (op === "finance_get_v1") {
      financialReads++;
      if (options.unread && financialReads === 1) return fail("TEMPORARY_FAILURE");
      return send({
        person_id: I.instructor,
        currency: "TRY",
        credit_available_minor: "20000",
        debts: [
          {
            id: I.agreement,
            center_id: I.center,
            remaining_minor: refunded ? "50000" : "60000",
            due_at: "2026-12-01T00:00:00Z",
            version: refunded ? 3 : 2,
          },
        ],
        movements: { items: [], next_cursor: null, as_of: "2026-11-16T10:00:00Z" },
      });
    }
    if (op === "entitlements_get_v1") return fail("FORBIDDEN");
    return route.fallback();
  });
  if (options.prefillPage2) {
    const grid = page.getByRole("grid", { name: "Hareketler", exact: true });
    await page.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
    await expect(grid.getByText("İkinci sayfa üyesi", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Önceki sayfa", exact: true }).click();
    await expect(grid.getByText("8 derslik paket", { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Satışı iade et", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Satışı iade et", exact: true });
  await panel.getByLabel("Gerekçe", { exact: true }).fill("Sentetik satış iadesi");
  return { ...state, writes, previews, receipts, panel };
}
async function prepare(state: Awaited<ReturnType<typeof setup>>) {
  await state.panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
}
async function approve(state: Awaited<ReturnType<typeof setup>>) {
  await state.panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await state.panel.getByRole("button", { name: "İadeyi uygula", exact: true }).click();
}
test("mobile sale refund uses the actual sale and provider amount, then reads finance without fabricating cash or rights", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await setup(page);
  await expect(
    state.panel.getByLabel("Tutar (para biriminin alt birimi)", { exact: true }),
  ).toHaveCount(0);
  await expect(state.panel.getByLabel("İşlem tarihi ve saati", { exact: true })).toHaveCount(0);
  await prepare(state);
  await expect(state.panel.getByText("₺100,00", { exact: true })).toBeVisible();
  await expect(
    state.panel.getByRole("button", { name: "İadeyi uygula", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  expect((await scanAccessibility(page, "sale-refund-native-review")).violations).toEqual([]);
  await approve(state);
  await expect(
    state.panel.getByText("İade komutu alındı; güncel finans okundu.", { exact: true }),
  ).toBeVisible();
  await expect(state.panel.getByText(/Hak okuması bu oturumda kullanılamıyor/)).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.previews).toHaveLength(1);
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
  await state.panel.getByRole("button", { name: copy.close, exact: true }).click();
  await expect(page.getByText("TRY ₺500,00 · EUR €100,00", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("grid", { name: "Hareketler", exact: true })
      .getByText("Nakit iade", { exact: true }),
  ).toHaveCount(0);
});
test("sale refund authority denial cannot become a preview or apply from center finance read", async ({
  page,
}) => {
  const state = await setup(page, { denied: true });
  await prepare(state);
  await expect(
    state.panel.getByText("Bu satış için iade yetkisi doğrulanamadı.", { exact: true }),
  ).toBeVisible();
  expect(state.previews).toHaveLength(0);
  expect(state.writes).toHaveLength(0);
});
test("unknown sale refund preserves its capability and key after receipt failure", async ({
  page,
}) => {
  const state = await setup(page, { unknown: true });
  await prepare(state);
  await approve(state);
  await expect(
    state.panel.getByText(copy.unknownWrite, {
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(state.panel).toBeVisible();
  await state.panel.getByRole("button", { name: copy.readResult, exact: true }).click();
  await expect.poll(() => state.receipts.length).toBe(1);
  await state.panel.getByRole("button", { name: copy.retrySame, exact: true }).click();
  await expect(
    state.panel.getByText("İade komutu alındı; güncel finans okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(new Set(state.writes.map((row) => row.operation_key)).size).toBe(1);
  expect(state.previews).toHaveLength(1);
});
test("acknowledged sale refund permits read recovery only after finance reading fails", async ({
  page,
}) => {
  const state = await setup(page, { unread: true });
  await prepare(state);
  await approve(state);
  await expect(
    state.panel.getByText(
      "İade komutu alındı; güncel finans henüz okunamadı. Yalnız sonucu yeniden oku.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(state.panel.getByRole("button", { name: copy.retrySame, exact: true })).toHaveCount(
    0,
  );
  await state.panel.getByRole("button", { name: copy.readResult, exact: true }).click();
  await expect(
    state.panel.getByText("İade komutu alındı; güncel finans okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.receipts).toHaveLength(0);
});

test("M05 sale refund reads current first page, then reopens an old cursor without replaying stale pages", async ({
  page,
}) => {
  const state = await setup(page, { prefillPage2: true });
  const before = state.requests.length;
  const cachedSecond = state.requests.filter((row) => row.page.cursor === "native-next").length;
  expect(cachedSecond).toBe(1);
  await prepare(state);
  await approve(state);
  await expect(
    state.panel.getByText("İade komutu alındı; güncel finans okundu.", { exact: true }),
  ).toBeVisible();
  const duringRefresh = state.requests.slice(before);
  expect(duringRefresh.filter((row) => row.page.cursor)).toHaveLength(0);
  expect(duringRefresh.filter((row) => row.view === "movements")).toHaveLength(1);
  expect(state.writes).toHaveLength(1);
  await state.panel.getByRole("button", { name: copy.close, exact: true }).click();
  await expect(page.getByText("TRY ₺500,00 · EUR €100,00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
  await expect(
    page.getByRole("grid", { name: "Hareketler", exact: true }).getByText("İkinci sayfa üyesi", {
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(() => state.requests.filter((row) => row.page.cursor === "native-next").length)
    .toBe(cachedSecond + 1);
  expect(state.writes).toHaveLength(1);
});
