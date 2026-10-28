import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("protected workspace redirects to login and recovery remains reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/giris$/);
  await expect(page.getByRole("heading", { name: "Hesabına giriş yap" })).toBeVisible();
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
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("button", { name: "Google ile devam et" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("auth pages reflow at 320px with 200 percent text without clipping controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  for (const route of ["/giris", "/parolami-unuttum"]) {
    await page.goto(route);
    await page.evaluate(async () => {
      document.documentElement.style.fontSize = "200%";
      await document.fonts.ready;
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const control of await page.locator("input, button").all()) {
      const bounds = await control.boundingBox();
      if (!bounds) throw new Error("Form control has no visible bounds");
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
      expect(
        await control.evaluate((element) => element.scrollHeight <= element.clientHeight),
      ).toBe(true);
    }
  }
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

test("language switching persists across reload and recovery without changing routes", async ({
  page,
}) => {
  await page.goto("/giris");
  await page.getByRole("combobox", { name: "Dil / Language" }).click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page).toHaveURL(/\/giris$/);
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByRole("combobox", { name: "Dil / Language" }).click();
  await page.getByRole("option", { name: "Türkçe", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Parolanı yenile" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
});

test("theme persists and both languages reflow with accessible controls", async ({ page }) => {
  await page.goto("/giris");
  await page.getByRole("combobox", { name: "Görünüm", exact: true }).click();
  await page.getByRole("option", { name: "Koyu", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.setViewportSize({ width: 320, height: 900 });
  for (const language of ["Türkçe", "English"]) {
    await page.getByRole("combobox", { name: "Dil / Language" }).click();
    await page.getByRole("option", { name: language, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "lang",
      language === "English" ? "en" : "tr",
    );
    await expect(page).toHaveTitle(
      language === "English" ? "Sign in to your account · FtkSaaS" : "Hesabına giriş yap · FtkSaaS",
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
