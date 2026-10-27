import { test, expect } from "@playwright/test";
test("native development login reads the real workspace and signs out", async ({ page }) => {
  await page.goto("/giris");
  await page.getByLabel("E-posta adresi").fill(process.env.FTK_E2E_EMAIL ?? "");
  await page.getByLabel("Parola", { exact: true }).fill(process.env.FTK_E2E_PASSWORD ?? "");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /^Merhaba,/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Kuruluş seç" })).toBeVisible();
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/giris$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/giris$/);
});
