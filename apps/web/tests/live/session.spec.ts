import { test, expect } from "@playwright/test";
test("native development login reads the real workspace and signs out", async ({ page }) => {
  let phase = "sign-in";
  try {
  await page.goto("/giris");
  await page.getByLabel("E-posta adresi").fill(process.env.FTK_E2E_EMAIL ?? "");
  await page.getByLabel("Parola", { exact: true }).fill(process.env.FTK_E2E_PASSWORD ?? "");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  phase = "authenticated route";
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /^Merhaba,/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Kuruluş seç" })).toBeVisible();
  phase = "organization selection";
  await page.getByRole("combobox", { name: "Kuruluş seç" }).click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("option").first().click();
  phase = "center selection";
  const center = page.getByRole("combobox", { name: "Merkez seç" });
  await expect(center).toBeEnabled();
  await center.click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("option").first().click();
  await expect(page.getByRole("status")).toContainText("İş zamanı:");
  phase = "sign-out";
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page).toHaveURL(/\/giris$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/giris$/);
  } catch {
    // Provider/locator failures can contain credentials or account data.
    // Close the live page before Playwright creates its automatic error context.
    await page.close();
    throw new Error(`Live acceptance failed at: ${phase}. No account details recorded.`);
  }
});
