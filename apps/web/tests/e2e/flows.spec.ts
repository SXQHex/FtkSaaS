import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("booking, request alternative and renewal reviews reflow without native traffic", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/functions/v1/") || request.url().includes("/storage/v1/"))
      calls.push(request.url());
  });
  await page.setViewportSize({ width: 320, height: 950 });
  await page.goto("/tasarim/rezervasyonlar");
  const bookings = page.getByRole("region", { name: "Seans rezervasyonları", exact: true });
  await bookings.getByRole("button", { name: "Sentetik Öğrenci" }).press("Enter");
  await bookings.getByRole("combobox", { name: "Kullanılacak hak" }).selectOption({ index: 1 });
  await bookings.getByRole("button", { name: "Rezervasyonu incele" }).press("Enter");
  await page.evaluate(async () => {
    document.documentElement.style.fontSize = "200%";
    await document.fonts.ready;
  });
  expect(await page.locator("main").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await bookings.getByRole("checkbox", { name: /Gösterilen işlemi/ }).check();
  await bookings.getByRole("button", { name: "İşlemi uygula" }).press("Enter");
  await expect(bookings.getByText(/Katılımcı 1/)).toBeVisible();
  const requests = page.getByRole("region", { name: "Özel ders talepleri", exact: true });
  await requests.getByRole("combobox", { name: "Talep işlemi" }).selectOption("offer_alternative");
  await requests.getByLabel("Başlangıç", { exact: true }).fill("2027-01-02T14:00");
  await requests.getByLabel("Bitiş", { exact: true }).fill("2027-01-02T15:00");
  await requests.getByRole("button", { name: "İşlemi incele", exact: true }).press("Enter");
  await requests.getByRole("checkbox", { name: /Gösterilen işlemi/ }).check();
  await requests.getByRole("button", { name: "İşlemi uygula" }).press("Enter");
  await expect(requests.getByText("Alternatif önerildi", { exact: true })).toBeVisible();
  const renewal = page.getByRole("region", { name: "Paket yenileme", exact: true });
  await renewal.getByRole("combobox", { name: "Yenilenecek satış" }).selectOption({ index: 1 });
  await renewal.getByRole("combobox", { name: "Yeni ürün sürümü" }).selectOption({ index: 1 });
  await renewal.getByLabel("Başlangıç tarihi", { exact: true }).fill("2027-02-01");
  await renewal.getByLabel("Bitiş tarihi", { exact: true }).fill("2027-03-01");
  await renewal.getByRole("button", { name: "Yenilemeyi incele" }).press("Enter");
  await expect(renewal.getByRole("heading", { name: "İşlemi incele" })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(calls).toEqual([]);
});
