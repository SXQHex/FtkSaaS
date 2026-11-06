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
  const skip = page.getByRole("link", { name: "İçeriğe geç" });
  await skip.focus();
  await skip.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
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

for (const locale of ["tr", "en"] as const) {
  test(`${locale} normal sale debt and deficit review is accessible at 320px and 200%`, async ({
    page,
  }) => {
    const calls: string[] = [];
    page.on("request", (request) => {
      if (/\/(functions|storage)\/v1\//.test(request.url())) calls.push(request.url());
    });
    await page.setViewportSize({ width: 320, height: 950 });
    await page.goto("/tasarim/rezervasyonlar");
    if (locale === "en") {
      await page.getByRole("combobox", { name: "Dil / Language" }).click();
      await page.getByRole("option", { name: "English", exact: true }).click();
      await page.getByRole("combobox", { name: "Appearance", exact: true }).click();
      await page.getByRole("option", { name: "Dark", exact: true }).click();
    }
    const sale = page.getByRole("region", {
      name: locale === "tr" ? "Yeni satış" : "New sale",
      exact: true,
    });
    await sale.getByRole("combobox").selectOption({ index: 1 });
    await sale.locator('input[name="start"]').fill("2027-02-01");
    await sale.locator('input[name="end"]').fill("2027-03-01");
    const inspect = sale.getByRole("button", {
      name: locale === "tr" ? "Satışı incele" : "Review sale",
      exact: true,
    });
    await inspect.press("Enter");
    await expect(
      sale.getByRole("heading", {
        name: locale === "tr" ? "İşlemi incele" : "Review action",
        exact: true,
      }),
    ).toBeFocused();
    await expect(
      sale.getByText(locale === "tr" ? "Oluşacak borç" : "Debt to create", { exact: true }),
    ).toBeVisible();
    await expect(
      sale.getByText(
        locale === "tr"
          ? "Bu satışla karşılanacak; mevcut rezervasyon korunur."
          : "Settled by this sale; the existing reservation is preserved.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.evaluate(async () => {
      document.documentElement.style.fontSize = "200%";
      await document.fonts.ready;
    });
    expect(
      await page.locator("main").evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    expect(await sale.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await sale
      .getByRole("button", {
        name: locale === "tr" ? "Düzenlemeye dön" : "Back to editing",
        exact: true,
      })
      .press("Enter");
    await expect(inspect).toBeFocused();
    await sale
      .getByRole("button", {
        name: locale === "tr" ? "Gerekli belgeler" : "Required documents",
        exact: true,
      })
      .click();
    const acceptanceLink = sale.getByRole("link", {
      name:
        locale === "tr"
          ? "Öğrenci için belge kabul bağlantısı"
          : "Document acceptance link for the student",
    });
    await expect(acceptanceLink).toBeVisible();
    await expect(acceptanceLink).toHaveAttribute(
      "href",
      /\/organizasyon\/[^/]+\/paket\/[^/]+\/belgeler\?center=/,
    );
    expect(await sale.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(calls).toEqual([]);
  });
}
