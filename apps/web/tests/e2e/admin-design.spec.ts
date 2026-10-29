import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("design preview supports navigation, browser history and class details without a session", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/functions/v1/") && request.method() === "POST")
      writes.push(request.url());
  });
  await page.goto("/tasarim");
  await expect(page.getByRole("heading", { name: "Stüdyoda bugün" })).toBeVisible();
  await expect(page.getByText("Tüm kişi ve veriler örnektir.")).toBeVisible();
  await expect(page.getByText("Kuruluş seç", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Ders detayını aç" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Tango başlangıç" })).toBeVisible();
  await expect(dialog).toContainText("18 / 24");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.getByRole("button", { name: "Takvime git" }).click();
  await expect(page).toHaveURL(/#schedule$/);
  await expect(page.getByRole("heading", { name: "Takvim", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "1 Kasım Pazar" }).click();
  await expect(page.getByRole("heading", { name: "Bugün ders yok" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Stüdyoda bugün" })).toBeVisible();
  expect(writes).toEqual([]);
});

test("student cards filter, open and add only an in-memory sample", async ({ page }) => {
  await page.goto("/tasarim#students");
  await expect(page.getByRole("heading", { name: "Öğrenciler", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yenileme yakın", exact: true }).click();
  await expect(page.getByText("2 örnek öğrenci gösteriliyor")).toBeVisible();
  await page.getByRole("textbox", { name: "Öğrenci ara…" }).fill("Selin");
  await expect(page.getByText("1 örnek öğrenci gösteriliyor")).toBeVisible();
  await page.getByRole("button", { name: "Profili aç" }).click();
  await expect(page.getByRole("dialog")).toContainText("Selin Aydın");
  await page.getByRole("dialog").getByRole("button", { name: "Kapat", exact: true }).click();
  await page.getByRole("button", { name: "Öğrenci ekle" }).click();
  await page.getByLabel("Ad soyad", { exact: true }).fill("Örnek Öğrenci");
  await page.getByRole("button", { name: "Önizlemeye ekle" }).click();
  await expect(page.getByRole("heading", { name: "Örnek Öğrenci" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Örnek Öğrenci" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Öğrenci ara…" }).fill("xxxxx");
  await expect(page.getByRole("heading", { name: "Öğrenci bulunamadı" })).toBeVisible();
  await page.getByRole("button", { name: "Filtreleri temizle" }).click();
  await expect(page.getByText("6 örnek öğrenci gösteriliyor")).toBeVisible();
});

test("page search works by keyboard and the selected page survives a reload", async ({ page }) => {
  await page.goto("/tasarim");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("textbox", { name: "Sayfalarda ara" }).fill("paket");
  await page.getByRole("dialog").getByRole("button", { name: "Paketler", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Paketler", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Paketler", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Paketi incele" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Tango başlangıç");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("mobile menu, light and dark views are accessible and do not overflow", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tasarim");
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await expect(
    page.getByRole("dialog").getByRole("navigation", { name: "Ana menü" }),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Ayarlar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ayarlar", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Görünüm", exact: true }).click();
  await page.getByRole("option", { name: "Koyu", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  for (const route of [
    "overview",
    "students",
    "packages",
    "finance",
    "reports",
    "studio",
    "inbox",
  ]) {
    await page.goto(`/tasarim#${route}`);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.goto("/tasarim");
  await page.screenshot({ path: testInfo.outputPath("admin-mobile-dark.png"), fullPage: true });
  await page.goto("/tasarim#settings");
  await page.getByRole("combobox", { name: "Görünüm", exact: true }).click();
  await page.getByRole("option", { name: "Açık", exact: true }).click();
  await page.goto("/tasarim");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("admin-mobile-light.png"), fullPage: true });
});

test("desktop shell collapses and English pages support enlarged text", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/tasarim");
  await page.screenshot({ path: testInfo.outputPath("admin-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Menüyü daralt" }).click();
  await expect(page.getByRole("button", { name: "Menüyü genişlet" })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "Ayarlar", exact: true }).click();
  await page.getByRole("combobox", { name: "Dil / Language" }).click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  for (const route of ["overview", "students", "packages", "settings"]) {
    await page.goto(`/tasarim#${route}`);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
