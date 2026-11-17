import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockEventDetail, detailIds as D } from "./event-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
const saved = "İşlem kaydedildi; güncel kayıt okundu.";
async function openPayment(
  page: Page,
  mode: "normal" | "unknown" | "unread" = "normal",
  denied = false,
  refreshFailure = false,
) {
  const state = await mockEventDetail(page, mode, {
    existing: "available",
    deniedCollection: denied,
    refreshFailure,
  });
  const row = page.getByRole("row", { name: /Mevcut kayıt/ });
  await expect(row).toContainText("400,00");
  await row.getByRole("button", { name: "Ödemeyi incele", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Ödemeyi incele", exact: true });
  await expect(sheet.getByText("Kaydın değişmez bedeli", { exact: true })).toBeVisible();
  await expect(
    sheet.getByRole("button", { name: "Ödeme hazırlığını oluştur", exact: true }),
  ).toHaveCount(0);
  await sheet.getByRole("radio", { name: "Şimdi tahsil edilecek", exact: true }).click();
  await sheet.getByLabel("Tutar (alt birim)", { exact: true }).fill("20000");
  await sheet.getByLabel("Yöntem", { exact: true }).selectOption("bank_transfer");
  await sheet.getByLabel("Referans", { exact: true }).fill("SENTETIK-KAYIT");
  await sheet.getByLabel("Tahsilat tarihi ve saati", { exact: true }).fill("2026-11-16T15:00");
  await sheet.getByRole("button", { name: "Tahsilatı incele", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
  return { state, sheet, confirmation };
}
async function collect(page: Page) {
  const d = page.getByRole("alertdialog");
  await d
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim, onaylıyorum.", exact: true })
    .press("Space");
  await d.getByRole("button", { name: "Tahsilatı kaydet", exact: true }).click();
}
test("existing unprepared registration collects only real debts with immutable fee and native balance readback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const { state, sheet, confirmation } = await openPayment(page);
  await expect(confirmation).toContainText("500,00");
  await expect(confirmation).not.toContainText("990,00");
  await expect(
    confirmation.getByRole("button", { name: "Tahsilatı kaydet", exact: true }),
  ).toBeDisabled();
  await collect(page);
  await expect(confirmation.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes.map((row) => row.op)).toEqual(["collection_record_v1"]);
  expect(state.writes[0]!.request).toMatchObject({
    person_id: I.instructor,
    currency: "TRY",
    amount_minor: "20000",
    debt_ids: [D.debt],
    payment: { method: "bank_transfer", reference: "SENTETIK-KAYIT" },
  });
  expect(state.payment).toBeUndefined();
  expect(
    state.reads.some(
      (row) =>
        row.op === "finance_get_v1" ||
        row.op === "event_payment_prepare_v1" ||
        row.op === "event_payment_get_v1",
    ),
  ).toBe(false);
  await confirmation.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(sheet).toContainText("300,00");
  await expect(sheet).toContainText("200,00");
  await sheet.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByRole("row", { name: /Mevcut kayıt/ })).toContainText("200,00");
});
test("existing registration unknown collection locks the sheet and recovers one native write", async ({
  page,
}) => {
  const { state, sheet, confirmation } = await openPayment(page, "unknown");
  await collect(page);
  await expect(
    confirmation.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await confirmation
    .getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true })
    .click();
  await expect(confirmation.getByText(saved, { exact: true })).toBeVisible();
  expect(state.effects).toBe(1);
  expect(state.writes).toHaveLength(1);
  await confirmation.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await sheet.getByRole("button", { name: "Vazgeç", exact: true }).click();
});
test("existing registration ACK recovery repeats only scoped receipt and balance reads", async ({
  page,
}) => {
  const { state, confirmation } = await openPayment(page, "unread");
  await collect(page);
  await expect(
    confirmation.getByText(
      "İşlem kaydedildi, güncel sonuç henüz okunamadı. Yalnız sonucu yeniden oku.",
      { exact: true },
    ),
  ).toBeVisible();
  await confirmation
    .getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true })
    .click();
  await expect(confirmation.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("changed existing registration balances are rejected before any collection", async ({
  page,
}) => {
  const { state, confirmation } = await openPayment(page);
  state.event.registrations![0]!.payment_summary!.remaining_minor = "30000";
  await collect(page);
  await expect(
    confirmation.getByText(
      "Kaydın ödeme bilgileri değişti. Güncel kaynağı yeniden oku ve işlemi tekrar incele.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("existing registration collection denial never fabricates a paid balance", async ({
  page,
}) => {
  const { state, confirmation } = await openPayment(page, "normal", true);
  await collect(page);
  await expect(
    confirmation.getByText("İşlem reddedildi. Güncel kaynağı oku ve koşulları kontrol et.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.event.registrations![0]!.payment_summary).toMatchObject({
    paid_minor: "10000",
    remaining_minor: "40000",
  });
});
for (const status of ["no_cash_due", "missing", "restricted"] as const)
  test(`registration payment ${status} stays distinct without preparing or collecting a debt`, async ({
    page,
  }) => {
    const state = await mockEventDetail(page, "normal", { existing: status });
    const row = page.getByRole("row", { name: /Mevcut kayıt/ });
    if (status === "restricted") {
      await expect(row).toContainText("Bu kaydın ödeme bilgilerini okuma yetkisi yok.");
      await expect(row.getByRole("button", { name: "Ödemeyi incele", exact: true })).toHaveCount(0);
    } else {
      await row.getByRole("button", { name: "Ödemeyi incele", exact: true }).click();
      const sheet = page.getByRole("dialog", { name: "Ödemeyi incele", exact: true });
      await expect(sheet).toContainText(
        status === "missing"
          ? "Kaydın ödeme kaynağı eksik; bakiye bilinmiyor."
          : "Nakit bedel gerekmiyor.",
      );
      await sheet.getByRole("radio", { name: "Şimdi tahsil edilecek", exact: true }).click();
      await expect(
        sheet.getByRole("button", { name: "Tahsilatı incele", exact: true }),
      ).toBeDisabled();
    }
    expect(state.writes).toHaveLength(0);
  });

test("existing collection retains its pending frame when the main event refresh fails after ACK", async ({
  page,
}) => {
  const { state, confirmation } = await openPayment(page, "normal", false, true);
  await collect(page);
  await expect(
    confirmation.getByText(
      "İşlem kaydedildi, güncel sonuç henüz okunamadı. Yalnız sonucu yeniden oku.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tango atölyesi", exact: true })).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await confirmation
    .getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true })
    .click();
  await expect(confirmation.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
