import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type { CashSummary, FinanceView } from "../src/lib/api-contracts/generated.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
const cashId = "019a7b00-0000-7000-8000-000000000061",
  debtId = "019a7b00-0000-7000-8000-000000000062";
async function setup(page: Page, options: { unknown?: boolean; allowed?: boolean } = {}) {
  const studio = await mockStudio(page),
    writes: Record<string, unknown>[] = [],
    reads: Record<string, unknown>[] = [];
  let movement: CashSummary | undefined;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON(),
      send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "finance_get_v1") {
      reads.push(req);
      expect(req.person_id).toBe(I.instructor);
      expect(req.currency).toBe("TRY");
      const data: FinanceView = {
        person_id: I.instructor,
        currency: "TRY",
        credit_available_minor: "0",
        debts: [
          {
            id: debtId,
            due_at: "2026-11-15T00:00:00Z",
            remaining_minor: movement ? "60000" : "100000",
            center_id: I.center,
            version: movement ? 2 : 1,
          },
        ],
        movements: {
          items: movement ? [movement] : [],
          next_cursor: null,
          as_of: new Date().toISOString(),
        },
      };
      return send(data);
    }
    if (op === "management_state_get_v1" && req.operation === "collection_record_v1") {
      expect(req.selector).toEqual({
        operation: "collection_record_v1",
        key: { person_id: I.instructor },
      });
      if (options.allowed === false)
        return route.fulfill({
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
      return send({
        items: [
          {
            operation: "collection_record_v1",
            exists: true,
            entity: { type: "people", id: I.instructor },
            state: "active",
            versions: [],
            current: { operation: "collection_record_v1", values: { person_id: I.instructor } },
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (op === "collection_record_v1") {
      writes.push(req);
      if (options.unknown && writes.length === 1) return route.abort();
      movement = {
        id: cashId,
        kind: "collection",
        amount_minor: req.amount_minor,
        currency: req.currency,
        occurred_at: req.occurred_at,
        center_id: I.center,
        version: 1,
        previous_id: null,
        payment: req.payment,
      };
      return send({ primary_id: cashId, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1")
      return route.fulfill({
        json: {
          ok: false,
          error: { code: "VALIDATION_FAILED", retryable: false, trace_id: I.role },
        },
      });
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/finance`);
  await page.getByLabel("Üye", { exact: true }).selectOption(I.instructor);
  await page.getByLabel("Para birimi", { exact: true }).fill("TRY");
  await page.getByRole("button", { name: "Finansı getir", exact: true }).click();
  await expect.poll(() => reads.length).toBeGreaterThan(0);
  await expect(page.getByRole("grid", { name: "Hareketler", exact: true })).toBeVisible();
  return { studio, writes, reads };
}
async function fillCollection(page: Page) {
  await page.getByRole("button", { name: "Tahsilat al", exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(panel).toHaveAccessibleName("Tahsilat al");
  await panel.getByLabel("Tutar (para biriminin alt birimi)", { exact: true }).fill("40000");
  await panel.getByRole("radio", { name: "Havale", exact: true }).click();
  await panel.getByLabel("İşlem referansı", { exact: true }).fill("SYNTHETIC-REF");
  await panel.getByLabel("İşlem tarihi ve saati", { exact: true }).fill("2026-11-15T14:30");
  return panel;
}

test("mobile collection uses explicit authority, reference and timezone then rereads the remaining debt", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await setup(page);
  await expect(page.getByRole("button", { name: "Tahsilat al", exact: true })).toBeEnabled();
  expect((await scanAccessibility(page, "finance-person-scope")).violations).toEqual([]);
  const panel = await fillCollection(page);
  const amount = panel.getByLabel("Tutar (para biriminin alt birimi)", { exact: true });
  await amount.fill("0");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(amount).toHaveAttribute("aria-invalid", "true");
  await expect(amount).toBeFocused();
  await expect(
    panel.getByText("Pozitif bir tam alt birim tutarı gir.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await amount.fill("40000");
  await expect(amount).toHaveAttribute("aria-invalid", "false");
  expect((await scanAccessibility(page, "collection-editor")).violations).toEqual([]);
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Tahsilatı kaydet", exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await expect(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true })).toBeChecked();
  expect((await scanAccessibility(page, "collection-review")).violations).toEqual([]);
  await panel.getByRole("button", { name: "Tahsilatı kaydet", exact: true }).click();
  await expect(
    panel.getByText("Tahsilat ve güncel finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    person_id: I.instructor,
    currency: "TRY",
    amount_minor: "40000",
    occurred_at: "2026-11-15T11:30:00Z",
    payment: { method: "bank_transfer", reference: "SYNTHETIC-REF" },
  });
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.getByRole("tab", { name: /Açık borçlar/ }).click();
  await expect(
    page
      .getByRole("grid", { name: "Açık borçlar", exact: true })
      .getByText("₺600,00", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
});
test("finance read does not enable collection when native writer authority is denied", async ({
  page,
}) => {
  const state = await setup(page, { allowed: false });
  await expect(
    page.getByText("Bu kişi için tahsilat yetkisi doğrulanamadı.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tahsilat al", exact: true })).toBeDisabled();
  await expect(page.getByRole("radio", { name: "Tahsilat", exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: /Açık borçlar/ }).click();
  await expect(page.getByRole("grid", { name: "Açık borçlar", exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
});
test("an unknown collection keeps the frozen key after receipt validation failure and locks navigation", async ({
  page,
}) => {
  const state = await setup(page, { unknown: true });
  const panel = await fillCollection(page);
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "Tahsilatı kaydet", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toBeEnabled();
  await panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }).click();
  await expect(
    panel.getByText("Tahsilat ve güncel finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]!.operation_key).toBe(state.writes[1]!.operation_key);
  expect(state.writes[0]!.amount_minor).toBe(state.writes[1]!.amount_minor);
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
});
