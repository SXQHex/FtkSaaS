import { test, expect } from "./test.js";
import { mockMemberAccount, confirmCalendar } from "./member-account-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import { studioIds as I } from "./studio-fixture.js";
import { uid } from "./pro-completion-fixture.js";
test("member account places five sections and saves native email reminder preference", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const state = await mockMemberAccount(page);
  await expect(page.locator('main [data-slot="card"] h2')).toHaveText([
    "Kişi bilgileri",
    "Belgeler",
    "Hesabı sil",
    "Takvimime ekle",
    "Bildirim tercihlerim",
  ]);
  await expect(page.getByRole("switch", { name: "Stüdyo duyuruları", exact: true })).toBeDisabled();
  await expect(
    page.getByRole("switch", { name: "Zorunlu bildirimler", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Zorunlu bildirimler", exact: true }),
  ).toBeDisabled();
  const email = page.getByRole("switch", { name: "E-posta ile hatırlatmalar", exact: true });
  await expect(email).not.toBeChecked();
  await page
    .locator("label")
    .filter({ hasText: /^E-posta ile hatırlatmalar$/ })
    .click();
  await expect(
    page.getByText("Tercih kaydedildi ve güncel durumu okundu.", { exact: true }),
  ).toBeVisible();
  await expect(email).toBeChecked();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]!.operation).toBe("notification_preferences_set_v1");
  await page.reload();
  await expect(email).toBeChecked();
});
test("transactional email uses its own native version and never changes the reminder preference", async ({
  page,
}) => {
  const state = await mockMemberAccount(page);
  const email = page.getByRole("switch", { name: "E-posta ile işlem bildirimleri", exact: true });
  const reminder = page.getByRole("switch", { name: "E-posta ile hatırlatmalar", exact: true });
  await expect(email).not.toBeChecked();
  await email.press("Space");
  await expect(email).toBeChecked();
  await page.reload();
  await expect(email).toBeChecked();
  await expect(reminder).not.toBeChecked();
  await email.press("Space");
  await expect(email).not.toBeChecked();
  await page.reload();
  await expect(email).toBeEnabled();
  await expect(email).not.toBeChecked();
  await expect(reminder).not.toBeChecked();
  expect(
    state.writes.map(({ request }) => [request.purpose, request.enabled, request.expected_version]),
  ).toEqual([
    ["transactional", true, 4],
    ["transactional", false, 5],
  ]);
});
test("Starter account shows native delivery limits and rejects another center from a direct URL", async ({
  page,
}) => {
  const state = await mockMemberAccount(page, { starter: true });
  const transactional = page.getByRole("switch", {
    name: "E-posta ile işlem bildirimleri",
    exact: true,
  });
  const reminder = page.getByRole("switch", { name: "E-posta ile hatırlatmalar", exact: true });
  const mandatory = page.getByRole("switch", { name: "Zorunlu bildirimler", exact: true });
  await expect(mandatory).toBeChecked();
  await expect(mandatory).toBeDisabled();
  await expect(transactional).not.toBeChecked();
  await expect(transactional).toBeDisabled();
  await expect(reminder).not.toBeChecked();
  await expect(reminder).toBeDisabled();
  expect(state.writes).toHaveLength(0);

  const otherCenter = uid(993);
  const preferencesReads = () =>
    state.reads.filter(({ operation }) => operation === "notifications_list_v1").length;
  const before = preferencesReads();
  await page.goto(`/member/account?org=${I.org}&center=${otherCenter}`);
  await expect(page.getByText("Organizasyon ve merkez seç.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "E-posta ile işlem bildirimleri", exact: true }),
  ).toHaveCount(0);
  expect(preferencesReads()).toBe(before);
  expect(state.writes).toHaveLength(0);
});
test("member calendar creates rotates and revokes with explicit review and version rereads", async ({
  page,
}) => {
  const state = await mockMemberAccount(page);
  let dialog = await confirmCalendar(page, "Takvim bağlantısı oluştur");
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveValue(
    /synthetic-1/,
  );
  expect((await scanAccessibility(page, "member-calendar-credential")).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  expect(state.links).toHaveLength(1);
  dialog = await confirmCalendar(page, "Bağlantıyı yenile");
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveValue(
    /synthetic-2/,
  );
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  dialog = await confirmCalendar(page, "Bağlantıyı iptal et");
  await expect(dialog.getByText(/İşlem tamamlandı ve güncel durum okundu/)).toBeVisible();
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  expect(state.links[0]!.state).toBe("revoked");
  expect(state.writes).toHaveLength(3);
  expect(state.writes[2]!.request.expected_version).toBe(2);
});
test("unknown calendar uses the same key and freezes navigation without exposing credential in URL or storage", async ({
  page,
}) => {
  const state = await mockMemberAccount(page, { unknownCalendar: true });
  const dialog = await confirmCalendar(page, "Takvim bağlantısı oluştur");
  await expect(dialog.getByText(/İşlemin sonucu bilinmiyor/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Üye menüsü", exact: true })
      .getByRole("link", { name: "Rezervasyonlarım", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveValue(
    /synthetic-1/,
  );
  expect(state.writes).toHaveLength(2);
  expect(state.links).toHaveLength(1);
  expect(state.writes[0]!.request.operation_key).toBe(state.writes[1]!.request.operation_key);
  expect(page.url()).not.toContain("synthetic");
  expect(
    await page.evaluate("JSON.stringify(localStorage)+JSON.stringify(sessionStorage)"),
  ).not.toContain("calendar.example.invalid");
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("acknowledged calendar retries only metadata reads", async ({ page }) => {
  const state = await mockMemberAccount(page, { ackUnread: true });
  const dialog = await confirmCalendar(page, "Takvim bağlantısı oluştur");
  await expect(dialog.getByText(/İşlem kaydedildi. Güncel durumu yeniden oku/)).toBeVisible();
  await dialog.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(dialog.getByText(/İşlem tamamlandı ve güncel durum okundu/)).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("unknown preference recovers receipt with one writer", async ({ page }) => {
  const state = await mockMemberAccount(page, { unknownPreference: true });
  await page
    .getByRole("switch", { name: "Uygulama içi hatırlatmalar", exact: true })
    .press("Space");
  await expect(page.getByText(/Kaydetme sonucu bilinmiyor/)).toBeVisible();
  await expect(page.getByLabel("Görünen ad", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "İşlem durumunu oku", exact: true }).click();
  await expect(
    page.getByText("Tercih kaydedildi ve güncel durumu okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await expect(
    page.getByRole("switch", { name: "Uygulama içi hatırlatmalar", exact: true }),
  ).not.toBeChecked();
});
test("denied account sources stay unavailable and recover by reading", async ({ page }) => {
  const state = await mockMemberAccount(page, { denied: true });
  await expect(page.getByText("Takvim bağlantıları okunamadı.", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Takvim bağlantısı oluştur", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("switch", { name: "Paket bitiş hatırlatmaları", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  state.setDenied(false);
  for (const button of await page.getByRole("button", { name: "Yeniden dene", exact: true }).all())
    await button.click();
  await expect(
    page.getByRole("button", { name: "Takvim bağlantısı oluştur", exact: true }),
  ).toBeEnabled();
});
test("changed calendar version requires a new review without sending a stale writer", async ({
  page,
}) => {
  const state = await mockMemberAccount(page);
  let dialog = await confirmCalendar(page, "Takvim bağlantısı oluştur");
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  state.links[0]!.version++;
  dialog = await confirmCalendar(page, "Bağlantıyı yenile");
  await expect(dialog.getByText(/Bağlantı değişti/)).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  dialog = await confirmCalendar(page, "Bağlantıyı yenile");
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveValue(
    /synthetic-3/,
  );
  expect(state.writes[1]!.request.expected_version).toBe(2);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("unready calendar service disables credential creation while metadata remains readable", async ({
  page,
}) => {
  const state = await mockMemberAccount(page, { serviceReady: false });
  await expect(
    page.getByRole("button", { name: "Takvim bağlantısı oluştur", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/Takvim bağlantısı hizmeti henüz hazır değil/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.evaluate("document.documentElement.dataset.theme='dark'");
});
