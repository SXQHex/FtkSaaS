import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("session change design requires preview, blocks conflicts and never calls the live backend", async ({
  page,
}) => {
  const domainRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/backend-v1/")) domainRequests.push(request.url());
  });
  await page.goto("/tasarim/seans");
  await expect(
    page.getByText("Bu sayfadaki seans ve işlemler örnektir. Gerçek kayıt değiştirilmez."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Seansı düzenle" }).click();
  await page.getByLabel("Toplam kontenjan").fill("31");
  await page.getByLabel("Değişiklik gerekçesi").fill("Örnek kapasite düzenlemesi");
  await page.getByRole("button", { name: "Değişikliği önizle" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("fiziksel sınırı");
  await expect(page.getByRole("button", { name: "Değişiklikleri uygula" })).toBeDisabled();
  await page.getByRole("button", { name: "Forma dön" }).click();
  await page.getByLabel("Toplam kontenjan").fill("24");
  await page.getByRole("button", { name: "Değişikliği önizle" }).click();
  await expect(page.getByText("Toplam kontenjan: 24")).toBeVisible();
  await page.getByRole("button", { name: "Değişiklikleri uygula" }).click();
  await expect(page.getByRole("status")).toHaveText("Değişiklikler kaydedildi");
  await page.getByRole("button", { name: "Güncel seansı göster" }).click();
  await expect(page.getByRole("button", { name: "Seansı düzenle" })).toBeVisible();
  expect(domainRequests).toEqual([]);
});

test("session change form and preview reflow at 320px with enlarged text in both languages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  for (const language of ["tr", "en"] as const) {
    await page.goto("/tasarim/seans");
    if (language === "en") {
      await page.getByRole("combobox", { name: "Dil / Language" }).click();
      await page.getByRole("option", { name: "English", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    }
    await page
      .getByRole("combobox", { name: language === "tr" ? "Görünüm" : "Appearance", exact: true })
      .click();
    await page
      .getByRole("option", { name: language === "tr" ? "Açık" : "Dark", exact: true })
      .click();
    await expect(page.locator("html")).toHaveClass(language === "tr" ? /light/ : /dark/);
    await page
      .getByRole("button", { name: language === "tr" ? "Seansı düzenle" : "Edit session" })
      .click();
    await page.evaluate(async () => {
      document.documentElement.style.fontSize = "200%";
      await document.fonts.ready;
    });
    expect(
      await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    ).toEqual({ width: 320, scrollWidth: 320 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByLabel(language === "tr" ? "Toplam kontenjan" : "Total capacity").fill("24");
    await page
      .getByLabel(language === "tr" ? "Değişiklik gerekçesi" : "Reason for change")
      .fill("Sample capacity change");
    await page
      .getByRole("button", {
        name: language === "tr" ? "Değişikliği önizle" : "Preview change",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: language === "tr" ? "Değişiklikleri uygula" : "Apply changes",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    ).toEqual({ width: 320, scrollWidth: 320 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
