import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("student design searches, pages, confirms status changes and explains open-operation rejection without live calls", async ({
  page,
}) => {
  const domainRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/backend-v1/")) domainRequests.push(request.url());
  });
  await page.goto("/tasarim/ogrenciler");
  await expect(
    page.getByText(
      "Bu sayfadaki kişiler ve işlemler örnektir. Gerçek kişi kaydı okunmaz veya değiştirilmez.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sonraki sayfa" }).click();
  await page.getByRole("button", { name: /Ece Örnek/ }).click();
  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "Öğrenciliği pasifleştir" }).click();
  await expect(detail.getByRole("button", { name: "Pasifleştirmeyi onayla" })).toBeDisabled();
  await detail.getByLabel("Pasifleştirme gerekçesi").fill("Örnek talep");
  await detail.getByRole("button", { name: "Pasifleştirmeyi onayla" }).click();
  await expect(detail.getByRole("alert")).toContainText("açık işlemleri var");
  await expect(detail.getByText("Öğrencilik işlemi kaydedildi")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Ece Örnek/ })).toBeFocused();
  await page.getByLabel("Öğrenci ara").fill("Deniz");
  await page.getByRole("button", { name: "Ara", exact: true }).click();
  const student = page.getByRole("button", { name: /Deniz Örnek/ });
  await student.focus();
  await page.keyboard.press("Enter");
  await expect(detail.getByText("deniz@example.invalid")).toBeVisible();
  await detail.getByRole("button", { name: "Öğrenciliği pasifleştir" }).click();
  await detail.getByLabel("Pasifleştirme gerekçesi").fill("Örnek ara verme");
  await detail.getByRole("button", { name: "Pasifleştirmeyi onayla" }).click();
  await expect(detail.getByRole("status")).toHaveText("Öğrencilik işlemi kaydedildi");
  await detail.getByRole("button", { name: "Güncel öğrenci bilgilerini göster" }).click();
  await expect(detail.getByRole("button", { name: "Öğrenciliği etkinleştir" })).toBeVisible();
  await detail.getByRole("button", { name: "Öğrenciliği etkinleştir" }).click();
  await detail.getByRole("button", { name: "Etkinleştirmeyi onayla" }).click();
  await detail.getByRole("button", { name: "Güncel öğrenci bilgilerini göster" }).click();
  await expect(detail.getByRole("button", { name: "Öğrenciliği pasifleştir" })).toBeVisible();
  await detail.getByRole("button", { name: "Detayı kapat" }).click();
  await page.getByLabel("Öğrenci ara").fill("Bulunmayan öğrenci");
  await page.getByRole("button", { name: "Ara", exact: true }).click();
  await expect(page.getByText("Aramana uygun öğrenci bulunamadı")).toBeVisible();
  expect(domainRequests).toEqual([]);
});

test("student list and confirmation reflow at 320px and 200% text with full axe in TR light and EN dark", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  for (const lang of ["tr", "en"] as const) {
    await page.goto("/tasarim/ogrenciler");
    if (lang === "en") {
      await page.getByRole("combobox", { name: "Dil / Language" }).click();
      await page.getByRole("option", { name: "English", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    }
    // Metadata streams separately from the localized page content.
    await expect(page.getByRole("combobox", { name: "Dil / Language" })).toBeEnabled();
    await expect(page).toHaveTitle(
      lang === "tr" ? "Öğrenci yönetimi tasarımı · FtkSaaS" : "Student management design · FtkSaaS",
    );
    await page
      .getByRole("combobox", { name: lang === "tr" ? "Görünüm" : "Appearance", exact: true })
      .click();
    await page.getByRole("option", { name: lang === "tr" ? "Açık" : "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveClass(lang === "tr" ? /light/ : /dark/);
    await page.evaluate(async () => {
      document.documentElement.style.fontSize = "200%";
      await document.fonts.ready;
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: /Deniz Örnek/ }).click();
    const detail = page.getByRole("dialog");
    await detail
      .getByRole("button", {
        name: lang === "tr" ? "Öğrenciliği pasifleştir" : "Deactivate student",
        exact: true,
      })
      .click();
    await detail
      .getByLabel(lang === "tr" ? "Pasifleştirme gerekçesi" : "Reason for deactivation")
      .fill("Örnek gerekçe");
    await expect(
      detail.getByRole("button", {
        name: lang === "tr" ? "Pasifleştirmeyi onayla" : "Confirm deactivation",
      }),
    ).toBeEnabled();
    const bounds = await detail.evaluate((node) => ({
      width: node.getBoundingClientRect().width,
      client: node.clientWidth,
      scroll: node.scrollWidth,
    }));
    expect(bounds.width).toBe(320);
    expect(bounds.scroll).toBe(bounds.client);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
