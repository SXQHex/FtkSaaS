import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockSessionDetail, sessionIds as S } from "./session-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { scanAccessibility } from "./accessibility.js";
async function booking(page: Page, options: Parameters<typeof mockSessionDetail>[1] = {}) {
  const state = await mockSessionDetail(page, options);
  await page.getByRole("button", { name: "Katılımcı ekle", exact: true }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Ara", exact: true }).click();
  await panel.getByLabel("Üye", { exact: true }).selectOption(I.self);
  await expect(panel.getByLabel("Hak kaynağı", { exact: true }).locator("option")).toHaveCount(2);
  await panel.getByLabel("Hak kaynağı", { exact: true }).selectOption(S.sale);
  return { ...state, panel };
}
async function approveBooking(panel: ReturnType<Page["getByRole"]>) {
  await panel
    .getByRole("checkbox", {
      name: "Seçili kişi, ders ve hak kaynağını kontrol ettim.",
      exact: true,
    })
    .press("Space");
  await panel.getByRole("button", { name: "Rezervasyon oluştur", exact: true }).click();
}
test("mobile session booking keeps explicit sale selection and reads native capacity without a false override grant", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await booking(page, { overrideDenied: true });
  await expect(
    state.panel.getByRole("checkbox", { name: "Kontenjanı aşarak ekle", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  expect((await scanAccessibility(page, "session-booking-review")).violations).toEqual([]);
  await approveBooking(state.panel);
  await expect(
    state.panel.getByText("Rezervasyon kaydedildi; güncel rezervasyon, haklar ve seans okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    operation: "reservation_create_v1",
    request: { person_id: I.self, source_sale_id: S.sale, mode: "flexible" },
  });
  await state.panel.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(
    page
      .getByRole("grid", { name: "Katılımcılar", exact: true })
      .getByText("Örnek öğrenci", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 / 12", { exact: true })).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
  expect((await scanAccessibility(page, "session-booking-result")).violations).toEqual([]);
});
test("booking with no eligible source in the selected session cannot submit or request an override", async ({
  page,
}) => {
  const state = await mockSessionDetail(page, { noBookingRights: true });
  await page.getByRole("button", { name: "Katılımcı ekle", exact: true }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Ara", exact: true }).click();
  const rightsRead = page.waitForResponse((response) =>
    response.url().endsWith("/entitlements_get_v1"),
  );
  await panel.getByLabel("Üye", { exact: true }).selectOption(I.self);
  expect((await rightsRead).request().postDataJSON()).toMatchObject({
    center_id: I.center,
    person_id: I.self,
    session_id: S.session,
  });
  await expect(panel.getByLabel("Hak kaynağı", { exact: true }).locator("option")).toHaveCount(1);
  await expect(
    panel.getByRole("button", { name: "Rezervasyon oluştur", exact: true }),
  ).toBeDisabled();
  await expect(
    panel.getByRole("checkbox", { name: "Kontenjanı aşarak ekle", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test("native capacity override is a separate reasoned command and never silently replaces ordinary booking", async ({
  page,
}) => {
  const state = await booking(page, { full: true });
  await state.panel
    .getByRole("checkbox", { name: "Kontenjanı aşarak ekle", exact: true })
    .press("Space");
  await state.panel.getByLabel("Gerekçe", { exact: true }).fill("Sentetik kontenjan gerekçesi");
  await approveBooking(state.panel);
  await expect(
    state.panel.getByText("Rezervasyon kaydedildi; güncel rezervasyon, haklar ve seans okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    operation: "reservation_capacity_override_v1",
    request: { reason: "Sentetik kontenjan gerekçesi", source_sale_id: S.sale },
  });
});
test("unknown booking recovers its exact receipt without a second write", async ({ page }) => {
  const state = await booking(page, { unknown: true });
  await approveBooking(state.panel);
  await expect(
    state.panel.getByText("Sonuç bilinmiyor. Aynı isteği yeniden dene veya işlem durumunu oku.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(state.panel).toBeVisible();
  await expect(state.panel.getByLabel("Üye", { exact: true })).toBeDisabled();
  await state.panel.getByRole("button", { name: "İşlem sonucunu oku", exact: true }).click();
  await expect(
    state.panel.getByText("Rezervasyon kaydedildi; güncel rezervasyon, haklar ve seans okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.reads).toContain("operation_status_get_v1");
});
test("acknowledged booking with a failed result read permits read recovery only", async ({
  page,
}) => {
  const state = await booking(page, { ackUnread: true });
  await approveBooking(state.panel);
  await expect(
    state.panel.getByText(
      "Kayıt alındı; güncel rezervasyon, hak ve seans henüz okunamadı. Yeniden yazmadan sonucu oku.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    state.panel.getByRole("button", { name: "Aynı isteği tekrar dene", exact: true }),
  ).toHaveCount(0);
  await state.panel.getByRole("button", { name: "İşlem sonucunu oku", exact: true }).click();
  await expect(
    state.panel.getByText("Rezervasyon kaydedildi; güncel rezervasyon, haklar ve seans okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("native attendance uses reservation versions then closes and corrects through explicit preview approval", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await mockSessionDetail(page, { existing: true, centerManager: true });
  await page.getByRole("button", { name: "Yoklamayı başlat", exact: true }).click();
  let dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Seans şimdi başladı");
  await dialog
    .getByRole("checkbox", { name: "Seansın şu an başladığını onaylıyorum.", exact: true })
    .press("Space");
  await dialog.getByRole("button", { name: "Yoklamayı başlat", exact: true }).click();
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel yoklama ve seans okundu.", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("tab", { name: "Yoklama", exact: true }).click();
  let panel = page.getByRole("tabpanel", { name: "Yoklama", exact: true });
  await panel
    .getByRole("combobox", { name: "Yoklama — Örnek öğrenci", exact: true })
    .selectOption("attended");
  await panel.getByRole("button", { name: "Kaydet — Örnek öğrenci", exact: true }).click();
  await expect
    .poll(() => state.writes.filter((w) => w.operation === "attendance_mark_v1").length)
    .toBe(1);
  await expect(
    panel.getByText("İşlem kaydedildi; güncel yoklama ve seans okundu.", { exact: true }),
  ).toBeVisible();
  expect(
    state.writes.find((w) => w.operation === "attendance_mark_v1")!.request.expected_version,
  ).toBe(2);
  await panel.getByRole("button", { name: "Yoklamayı kapat", exact: true }).click();
  dialog = page.getByRole("alertdialog");
  await dialog.getByRole("checkbox", { name: "Seans gerçekleşti", exact: true }).press("Space");
  await dialog.getByRole("checkbox", { name: "Örnek Eğitmen", exact: true }).press("Space");
  await dialog
    .getByRole("checkbox", {
      name: "Yoklama sonuçlarını ve gerçekleşen eğitmenleri kontrol ettim.",
      exact: true,
    })
    .press("Space");
  expect((await scanAccessibility(page, "session-attendance-close-review")).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Yoklamayı kapat", exact: true }).click();
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel yoklama ve seans okundu.", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await panel.getByRole("button", { name: "Yoklamayı düzenle", exact: true }).click();
  await panel
    .getByRole("combobox", { name: "Yoklama — Örnek öğrenci", exact: true })
    .selectOption("no_show");
  await panel.getByLabel("Düzeltme gerekçesi", { exact: true }).fill("Sentetik yoklama düzeltmesi");
  await panel.getByRole("button", { name: "Düzeltmeyi incele", exact: true }).click();
  const review = page.getByRole("dialog");
  await expect(review.getByText("Serbest bırakma", { exact: true })).toBeVisible();
  expect(state.writes.filter((w) => w.operation === "attendance_correct_apply_v1")).toHaveLength(0);
  await review.getByRole("checkbox").press("Space");
  expect(
    (await scanAccessibility(page, "session-attendance-correction-review")).violations,
  ).toEqual([]);
  await review.getByRole("button", { name: "Düzeltmeyi kaydet", exact: true }).click();
  await expect(
    review.getByText("İşlem kaydedildi; güncel yoklama ve seans okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.attendance.revision).toBe(2);
  expect(state.attendance.entries[0]!.result).toBe("no_show");
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(
    panel.getByRole("combobox", { name: "Yoklama — Örnek öğrenci", exact: true }),
  ).toHaveValue("no_show");
  expect((await scanAccessibility(page, "session-attendance-corrected")).violations).toEqual([]);
});
test("a denied attendance reader preserves the independent native session and participant list", async ({
  page,
}) => {
  await mockSessionDetail(page, { existing: true, attendanceDenied: true });
  await expect(
    page
      .getByRole("grid", { name: "Katılımcılar", exact: true })
      .getByText("Örnek öğrenci", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sentetik seans", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yoklamayı başlat", exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: "Yoklama", exact: true }).click();
  await expect(
    page
      .getByRole("tabpanel", { name: "Yoklama", exact: true })
      .getByText("Bu bölüm okunamadı. Yeniden deneyebilirsin.", { exact: true }),
  ).toBeVisible();
});

test("a changed native session invalidates booking approval before any writer", async ({
  page,
}) => {
  const state = await booking(page);
  state.session.version++;
  await approveBooking(state.panel);
  await expect(
    state.panel.getByText(
      "Seans veya seçilen hak kaynağı değişti. Güncel seçimi inceleyip yeniden onayla.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await expect(
    state.panel.getByRole("checkbox", {
      name: "Seçili kişi, ders ve hak kaynağını kontrol ettim.",
      exact: true,
    }),
  ).not.toBeChecked();
  await approveBooking(state.panel);
  await expect(
    state.panel.getByText("Rezervasyon kaydedildi; güncel rezervasyon, haklar ve seans okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("a denied native attendance command leaves the readable session intact", async ({ page }) => {
  const state = await mockSessionDetail(page, { existing: true, writeDenied: true });
  await page.getByRole("button", { name: "Yoklamayı başlat", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Seans şimdi başladı");
  await dialog
    .getByRole("checkbox", { name: "Seansın şu an başladığını onaylıyorum.", exact: true })
    .press("Space");
  await dialog.getByRole("button", { name: "Yoklamayı başlat", exact: true }).click();
  await expect(
    dialog.getByText("İşlem reddedildi. Güncel izin, plan ve yoklama koşullarını kontrol et.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.session.version).toBe(3);
  expect(state.attendance.actual_started_at).toBeNull();
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sentetik seans", exact: true })).toBeVisible();
});
test("schedule detail opens the protected session route without requiring editing policy", async ({
  page,
}) => {
  const now = new Date("2026-11-18T09:00:00Z");
  await page.clock.setFixedTime(now);
  const state = await mockSessionDetail(page, { now });
  await page.getByRole("link", { name: "Ders programı", exact: true }).last().click();
  await page
    .getByRole("button", { name: /Sentetik seans/ })
    .filter({ visible: true })
    .click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("heading", { name: "Sentetik seans", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Seans sayfasını aç", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${S.session}$`));
  await expect(page.getByRole("heading", { name: "Sentetik seans", exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

for (const [action, trigger, heading] of [
  ["edit", "Seansı düzenle", "Seansı düzenle"],
  ["cancel", "Seansı iptal et", "Seansı iptal et"],
  ["instructor", "Değiştir", "Eğitmeni değiştir"],
] as const) {
  test(`session ${action} opens the existing native schedule editor with no automatic write`, async ({
    page,
  }) => {
    const state = await mockSessionDetail(page, { allowEditor: true });
    await page.getByRole("button", { name: trigger, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`schedule\\?session=${S.session}&action=${action}$`));
    const panel = page.getByRole("dialog");
    await expect(panel.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Etkiyi önizle", exact: true })).toBeVisible();
    if (action === "edit") await expect(panel.getByLabel("Tarih", { exact: true })).toBeVisible();
    expect(state.writes).toHaveLength(0);
  });
}

test("M01 session mutation resets stale participant cursors", async ({ page }) => {
  const state = await mockSessionDetail(page, {
    existing: true,
    centerManager: true,
    paginatedParticipants: true,
  });
  const panel = page.getByRole("tabpanel", { name: "Katılımcılar", exact: true });
  const next = panel.getByRole("button", { name: "Sonraki", exact: true });
  await next.click();
  const oldReads = () =>
    state.participantReads.filter((read) => read.cursor === "stale-participant").length;
  await expect.poll(oldReads).toBe(1);
  await page.getByRole("button", { name: "Yoklamayı başlat", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Seans şimdi başladı");
  await dialog
    .getByRole("checkbox", { name: "Seansın şu an başladığını onaylıyorum.", exact: true })
    .press("Space");
  await dialog.getByRole("button", { name: "Yoklamayı başlat", exact: true }).click();
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel yoklama ve seans okundu.", { exact: true }),
  ).toBeVisible();
  const staleAfterWrite = state.participantReads.filter(
    (read) => read.cursor === "stale-participant" && read.afterWrite,
  );
  expect(staleAfterWrite).toHaveLength(0);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Önceki", exact: true })).toBeDisabled();
  await next.click();
  const freshReads = () =>
    state.participantReads.filter((read) => read.cursor === "fresh-participant").length;
  await expect.poll(freshReads).toBe(1);
  expect(state.writes.filter((write) => write.operation === "attendance_start_v1")).toHaveLength(1);
});
