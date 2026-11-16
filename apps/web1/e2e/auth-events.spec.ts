import { test, expect } from "./test.js";
import { mockEvents, openEvent, reviewEvent } from "./events-fixture.js";
const saved = "İşlem kaydedildi; güncel kayıt okundu.";
test("event list uses native period, enabled filters and real directory summaries", async ({
  page,
}) => {
  const state = await mockEvents(page);
  await expect(page.getByRole("row", { name: /Tango atölyesi/ })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Etkinlik ara", exact: true })).toBeEnabled();
  await expect(page.getByRole("radio", { name: "Yayında", exact: true })).toBeEnabled();
  expect(state.reads[0]).toMatchObject({
    include_summary: true,
    status: "all",
    interval: { starts_at: "2026-10-31T21:00:00Z", ends_at: "2026-11-30T21:00:00Z" },
  });
  await page.getByLabel("Dönem", { exact: true }).fill("2026-12");
  await expect(page.getByText("Bu kapsamda görünür etkinlik yok.", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("event edit requires review and confirms the exact draft without publishing or registering", async ({
  page,
}) => {
  const state = await mockEvents(page),
    dialog = await openEvent(page);
  await dialog.getByLabel("Başlık", { exact: true }).fill("Yeni atölye");
  await expect(dialog.getByRole("button", { name: "Taslak kaydet", exact: true })).toBeDisabled();
  await reviewEvent(page);
  await dialog.getByRole("button", { name: "Taslak kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.effects).toBe(1);
  expect(state.writes[0]).toMatchObject({ expected_version: 1, name: "Yeni atölye" });
  expect(state.events[0]!.state).toBe("draft");
  await expect(dialog.getByLabel("Başlık", { exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Yeni atölye", exact: true })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Etkinlikler", exact: true }).click();
  await expect(page.getByRole("row", { name: /Yeni atölye/ })).toBeVisible();
});
test("invalid event capacity focuses the error summary and never reaches a writer", async ({
  page,
}) => {
  const state = await mockEvents(page),
    dialog = await openEvent(page);
  await dialog.getByLabel("En yüksek kontenjan", { exact: true }).fill("9");
  await reviewEvent(page);
  await dialog.getByRole("button", { name: "Taslak kaydet", exact: true }).click();
  await expect(dialog.locator('[role="alert"][tabindex="-1"]')).toBeFocused();
  expect(state.writes).toHaveLength(0);
});
test("unknown event reply freezes the form and recovers the receipt with one writer", async ({
  page,
}) => {
  const state = await mockEvents(page, "unknown"),
    dialog = await openEvent(page);
  await dialog.getByLabel("Başlık", { exact: true }).fill("Kurtarılan atölye");
  await reviewEvent(page);
  await dialog.getByRole("button", { name: "Taslak kaydet", exact: true }).click();
  await expect(dialog.getByText(/Sonuç bilinmiyor/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.effects).toBe(1);
});
test("acknowledged event result failure only rereads the native result", async ({ page }) => {
  const state = await mockEvents(page, "result"),
    dialog = await openEvent(page);
  await dialog.getByLabel("Başlık", { exact: true }).fill("Okunan atölye");
  await reviewEvent(page);
  await dialog.getByRole("button", { name: "Taslak kaydet", exact: true }).click();
  await expect(dialog.getByText(/güncel sonuç henüz okunamadı/)).toBeVisible();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("stale event preflight reloads the current version before a new reviewed write", async ({
  page,
}) => {
  const state = await mockEvents(page),
    dialog = await openEvent(page);
  state.events[0]!.version = 2;
  await dialog.getByLabel("Başlık", { exact: true }).fill("Yeni sürüm");
  await reviewEvent(page);
  await dialog.getByRole("button", { name: "Taslak kaydet", exact: true }).click();
  await expect(
    dialog.getByText("Kaynak sürümü değişti. Güncel kaydı oku, şartları yeniden incele.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await dialog.getByRole("button", { name: "Güncel verileri yükle", exact: true }).click();
  await dialog.getByLabel("Başlık", { exact: true }).fill("Güncel sürüm");
  await reviewEvent(page);
  await dialog.getByRole("button", { name: "Taslak kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes[0]!.expected_version).toBe(2);
});
test("forbidden event directory stays unread and does not claim an empty program", async ({
  page,
}) => {
  await mockEvents(page, "denied");
  await expect(
    page.getByText("Etkinlik kaynağı okunamadı. Güncel yetkili kaynağı yeniden oku.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Bu kapsamda görünür etkinlik yok.", { exact: true })).toHaveCount(0);
});
test("new package practice draft uses an external unlimited venue and never consumes a lesson right", async ({
  page,
}) => {
  const state = await mockEvents(page, "empty");
  await page.setViewportSize({ width: 320, height: 750 });
  await page.getByRole("button", { name: "Etkinlik ekle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Başlık", { exact: true }).fill("Pratik gecesi");
  await dialog.getByRole("radio", { name: "Paketli Pratik", exact: true }).click();
  await dialog.getByLabel("Başlangıç tarihi ve saati", { exact: true }).fill("2026-11-20T20:00");
  await dialog.getByLabel("Bitiş tarihi ve saati", { exact: true }).fill("2026-11-20T23:00");
  await dialog.getByRole("radio", { name: "Dış mekân", exact: true }).click();
  await dialog.getByLabel("Mekân adı", { exact: true }).fill("Açık alan");
  await dialog.getByLabel("Adres", { exact: true }).fill("Açık adres");
  await dialog.getByRole("switch", { name: "Kontenjan sınırsız", exact: true }).press("Space");
  await dialog.getByLabel("Para birimi", { exact: true }).fill("TRY");
  await dialog.getByRole("checkbox", { name: "Pratik paketi", exact: true }).press("Space");
  await dialog.getByLabel("Sınırdan önce", { exact: true }).selectOption("release");
  await dialog.getByLabel("Sınırdan sonra", { exact: true }).selectOption("consume");
  await dialog.getByLabel("Gelmediğinde", { exact: true }).selectOption("consume");
  await dialog.getByLabel("İade yöntemi", { exact: true }).selectOption("none");
  await reviewEvent(page);
  await dialog.getByRole("button", { name: "Taslak kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes[0]).toMatchObject({
    capacity: { kind: "unlimited" },
    terms: { fee_minor: "0", package_usage: "eligibility_only" },
    discipline_ids: [],
  });
  expect(state.effects).toBe(1);
});

test("event directory uses server filters and independent summaries while resetting every cursor", async ({
  page,
}) => {
  const state = await mockEvents(page, "directory");
  await expect(page.getByRole("row", { name: /Tango 0 Atölye/ })).toBeVisible();
  const metric = (label: string) =>
    page
      .locator('[data-slot="card"]')
      .filter({ has: page.locator('[data-slot="card-description"]', { hasText: label }) })
      .first()
      .locator('[data-slot="card-title"]');
  await expect(metric("Yayında")).toHaveText("11");
  await expect(metric("Taslak")).toHaveText("10");
  await expect(metric("Kayıtlı üye")).toHaveText("22");
  await expect(metric("Bekleyen ödeme")).toContainText("900,00");
  await expect(metric("Bekleyen ödeme")).toContainText("200,00");
  await expect(page.getByRole("row", { name: /Tango 0 Atölye/ })).toContainText("2 / 16");
  await page.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect(page.getByRole("row", { name: /Tango 20 Atölye/ })).toBeVisible();
  expect(state.reads.at(-1)!.page).toMatchObject({ cursor: "directory-next" });
  await expect(metric("Yayında")).toHaveText("11");
  await page.getByRole("radio", { name: "Yayında", exact: true }).click();
  await expect.poll(() => state.reads.at(-1)!.status).toBe("published");
  expect(state.reads.at(-1)!.page).not.toHaveProperty("cursor");
  await expect(metric("Taslak")).toHaveText("10");
  await page.getByRole("searchbox", { name: "Etkinlik ara", exact: true }).fill(" Tango 20 ");
  await expect.poll(() => state.reads.at(-1)!.query).toBe("Tango 20");
  await expect(page.getByRole("row", { name: /Tango 20 Atölye/ })).toBeVisible();
  expect(state.reads.at(-1)!.page).not.toHaveProperty("cursor");
  await page.getByRole("searchbox", { name: "Etkinlik ara", exact: true }).fill("   ");
  await expect(page.getByRole("row", { name: /Tango 0 Atölye/ })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Etkinlik ara", exact: true })).toHaveValue(
    "   ",
  );
  expect(state.reads.filter((r) => r.query === undefined).at(-1)!).toMatchObject({
    status: "published",
  });
  expect(state.writes).toHaveLength(0);
});
test("event directory never presents missing payment sources as zero debt", async ({ page }) => {
  await mockEvents(page, "directory", { missingPayments: true });
  await expect(page.getByText("Ödeme kaynağı eksik", { exact: true })).toBeVisible();
  await expect(
    page.getByText("1 kaydın ödeme kaynağı eksik; bakiyesi sıfır sayılmadı.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bekleyen borç yok", { exact: true })).toHaveCount(0);
});
test("limited event reader retains native filters without requesting manager summaries", async ({
  page,
}) => {
  const state = await mockEvents(page, "directory", { limited: true });
  await expect(
    page.getByText("Merkez özeti bu yetki kapsamında okunamıyor.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("row", { name: /Tango 0 Atölye/ })).toBeVisible();
  expect(state.reads[0]).not.toHaveProperty("include_summary");
  await expect(page.getByRole("row", { name: /Tango 0 Atölye/ })).toContainText("— / 16");
  await page.getByRole("radio", { name: "Yayında", exact: true }).click();
  await expect.poll(() => state.reads.at(-1)!.status).toBe("published");
  expect(state.reads.at(-1)!).not.toHaveProperty("include_summary");
});
