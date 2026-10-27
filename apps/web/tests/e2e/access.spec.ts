import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("protected workspace redirects to login and recovery remains reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/giris$/);
  await expect(page.getByRole("heading", { name: "Yönetim alanına giriş" })).toBeVisible();
  await page.getByRole("link", { name: "Parolamı unuttum" }).click();
  await expect(page.getByRole("heading", { name: "Parolanı yenile" })).toBeVisible();
});
test("login supports keyboard navigation, accessible names, and enlarged text", async ({
  page,
}) => {
  await page.goto("/giris");
  await page.getByRole("link", { name: "İçeriğe geç" }).focus();
  await expect(page.getByRole("link", { name: "İçeriğe geç" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect(page.getByRole("button", { name: "Google ile devam et" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("expired callback returns a usable error and password update requires a session", async ({
  page,
}) => {
  await page.goto("/giris?error=callback");
  await expect(page.getByRole("alert", { name: "Giriş hatası" })).toContainText(
    "Giriş bağlantısı geçersiz",
  );
  await page.goto("/parola-yenile");
  await expect(page).toHaveURL(/\/giris\?error=session$/);
});
