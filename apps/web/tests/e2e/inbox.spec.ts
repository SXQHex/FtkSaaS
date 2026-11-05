import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
function domainRequests(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/functions/v1/") || request.url().includes("/storage/v1/"))
      requests.push(request.url());
  });
  return requests;
}
async function enlarged(page: Page) {
  await page.evaluate(async () => {
    document.documentElement.style.fontSize = "200%";
    await document.fonts.ready;
  });
}
async function accessible(page: Page) {
  expect(await page.locator("main").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}
test("notification preference approval works by keyboard with enlarged text in both locales", async ({
  page,
}) => {
  const requests = domainRequests(page);
  await page.setViewportSize({ width: 320, height: 950 });
  for (const lang of ["tr", "en"] as const) {
    await page.goto("/tasarim/bildirimler");
    if (lang === "en") {
      await page.getByRole("combobox", { name: "Dil / Language" }).click();
      await page.getByRole("option", { name: "English", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    }
    await page
      .getByRole("combobox", { name: lang === "tr" ? "Görünüm" : "Appearance", exact: true })
      .click();
    await page.getByRole("option", { name: lang === "tr" ? "Açık" : "Dark", exact: true }).click();
    const preferences = page.getByRole("region", {
      name: lang === "tr" ? "Bildirim tercihleri" : "Notification preferences",
    });
    await expect(preferences.getByRole("checkbox")).not.toBeChecked();
    await preferences.getByRole("checkbox").press("Space");
    await preferences
      .getByRole("button", { name: lang === "tr" ? "Değişikliği incele" : "Review change" })
      .press("Enter");
    const save = preferences.getByRole("button", {
      name: lang === "tr" ? "Tercihimi kaydet" : "Save my preference",
    });
    await expect(save).toBeFocused();
    await enlarged(page);
    await accessible(page);
    await preferences
      .getByRole("button", { name: lang === "tr" ? "Vazgeç" : "Cancel" })
      .press("Enter");
    await expect(
      preferences.getByRole("button", {
        name: lang === "tr" ? "Değişikliği incele" : "Review change",
      }),
    ).toBeFocused();
    await preferences
      .getByRole("button", { name: lang === "tr" ? "Değişikliği incele" : "Review change" })
      .press("Enter");
    await save.press("Enter");
    await expect(preferences.getByRole("checkbox")).toBeChecked();
    await expect(preferences.getByRole("heading")).toBeFocused();
    await accessible(page);
  }
  expect(requests).toEqual([]);
});
test("inbox pagination, exact read approval and authorized history are accessible without live domain calls", async ({
  page,
}) => {
  const requests = domainRequests(page);
  await page.setViewportSize({ width: 320, height: 950 });
  await page.goto("/tasarim/bildirimler");
  const inbox = page.getByRole("region", { name: "Bildirim kutusu", exact: true });
  await inbox.getByRole("button", { name: "Sonraki sayfa" }).press("Enter");
  await expect(inbox.getByText("Örnek ikinci bildirim")).toBeVisible();
  await inbox.getByRole("checkbox", { name: "Yalnız okunmamış" }).press("Space");
  await expect(inbox.getByText("Örnek program değişikliği")).toBeVisible();
  await inbox.getByRole("button", { name: "Okundu olarak işaretle" }).press("Enter");
  await expect(inbox.getByRole("button", { name: "Okundu olarak onayla" })).toBeFocused();
  await enlarged(page);
  await accessible(page);
  await inbox.getByRole("button", { name: "Vazgeç" }).press("Enter");
  await expect(inbox.getByRole("button", { name: "Okundu olarak işaretle" })).toBeFocused();
  const history = inbox.getByRole("button", { name: "Kayıt geçmişi" });
  await history.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Örnek yönetici")).toBeVisible();
  await expect(dialog).not.toContainText("private-new");
  await expect(dialog).not.toContainText("private-old");
  await accessible(page);
  await dialog.getByRole("button", { name: "Sonraki sayfa" }).press("Enter");
  await expect(dialog.getByText("İkinci örnek aktör")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(history).toBeFocused();
  await inbox.getByRole("button", { name: "Okundu olarak işaretle" }).press("Enter");
  await inbox.getByRole("button", { name: "Okundu olarak onayla" }).press("Enter");
  await expect(inbox.getByText("Okunmuş", { exact: true })).toBeVisible();
  await expect(inbox.getByRole("checkbox")).not.toBeChecked();
  await expect(inbox.getByRole("heading", { name: "Bildirim kutusu" })).toBeFocused();
  expect(requests).toEqual([]);
});
test("uncertain inbox command keeps recovery controls usable at narrow enlarged text", async ({
  page,
}) => {
  const requests = domainRequests(page);
  await page.setViewportSize({ width: 320, height: 950 });
  await page.goto("/tasarim/bildirimler");
  await page
    .getByRole("button", { name: "Sonraki okundu işleminde yanıt kaybını örnekle" })
    .press("Enter");
  const inbox = page.getByRole("region", { name: "Bildirim kutusu", exact: true });
  await inbox.getByRole("button", { name: "Okundu olarak işaretle" }).press("Enter");
  await inbox.getByRole("button", { name: "Okundu olarak onayla" }).press("Enter");
  await expect(inbox.getByRole("button", { name: "Aynı işlemi yeniden gönder" })).toBeVisible();
  await enlarged(page);
  await accessible(page);
  await inbox.getByRole("button", { name: "İşlem sonucunu kontrol et" }).press("Enter");
  await expect(inbox.getByText("Bu görünümde bildirim yok.")).toBeVisible();
  await expect(inbox.getByRole("heading", { name: "Bildirim kutusu" })).toBeFocused();
  await accessible(page);
  expect(requests).toEqual([]);
});
