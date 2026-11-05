import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("package publication reviews the exact terms and reflows without live writes", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/functions/v1/") || r.url().includes("/storage/v1/")) calls.push(r.url());
  });
  await page.setViewportSize({ width: 320, height: 950 });
  await page.goto("/tasarim/paketler");
  await page.getByRole("button", { name: "Yeni paket yayımla" }).press("Enter");
  await page
    .getByRole("combobox", { name: "Disiplin", exact: true })
    .selectOption({ label: "Salsa" });
  await page.getByRole("textbox", { name: "Paket adı eki" }).fill("Tarayıcı");
  await page.getByRole("combobox", { name: "Paket türü" }).selectOption("quota");
  await page.getByRole("spinbutton", { name: "Dönem kotası" }).fill("4");
  await page.getByRole("textbox", { name: "Para birimi" }).fill("TRY");
  await page.getByRole("textbox", { name: "Fiyat", exact: true }).fill("123,45");
  await page.getByRole("button", { name: "Yayını incele" }).press("Enter");
  const publish = page.getByRole("button", { name: "Bu sürümü yayımla" });
  await expect(publish).toBeFocused();
  await page.evaluate(async () => {
    document.documentElement.style.fontSize = "200%";
    await document.fonts.ready;
  });
  expect(await page.locator("main").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Vazgeç" }).press("Enter");
  await expect(page.getByRole("button", { name: "Yayını incele" })).toBeFocused();
  await page.getByRole("button", { name: "Yayını incele" }).press("Enter");
  await publish.press("Enter");
  await expect(page.getByRole("heading", { name: "Salsa Tarayıcı", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paket kataloğu", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Hakları göster" }).press("Enter");
  await expect(page.getByText("Kullanılabilir kredi", { exact: true })).toHaveCount(1);
  await expect(page.getByText(/Süreli hakta kullanılabilirlik/)).toHaveCount(2);
  expect(await page.locator("main").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(calls).toEqual([]);
});
test("catalog and purchased rights remain accessible with enlarged English dark text", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/functions/v1/")) calls.push(r.url());
  });
  await page.setViewportSize({ width: 320, height: 950 });
  await page.goto("/tasarim/paketler");
  await page.getByRole("combobox", { name: "Dil / Language" }).click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("combobox", { name: "Appearance", exact: true }).click();
  await page.getByRole("option", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "Show rights" }).press("Enter");
  await expect(page.getByText("Available credits", { exact: true })).toHaveCount(1);
  await page.evaluate(async () => {
    document.documentElement.style.fontSize = "200%";
    await document.fonts.ready;
  });
  expect(await page.locator("main").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(calls).toEqual([]);
});
