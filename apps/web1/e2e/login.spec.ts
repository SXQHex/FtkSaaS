import { expect, test } from "./test.js";
import { scanAccessibility } from "./accessibility.js";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`login keyboard, validation and accessibility ${viewport.width} ${colorScheme}`, async ({
      page,
      context,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await context.route("**/*", async (route) => {
        expect(new URL(route.request().url()).origin).toBe("http://127.0.0.1:4173");
        await route.continue();
      });
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "Hesabına giriş yap" })).toBeVisible();
      expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
      await page.getByLabel("E-posta").focus();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Parolamı unuttum" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("Parola", { exact: true })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByLabel("E-posta")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Geçerli bir e-posta adresi gir.")).toBeVisible();
      const results = await scanAccessibility(page);
      expect(results.violations).toEqual([]);
      expect(errors).toEqual([]);
      await testInfo.attach(`login-${viewport.width}-${colorScheme}`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    });
  }
}

test("callback provider errors remove query and fragment credentials without a false success", async ({
  page,
  context,
}) => {
  await context.route("**/*", async (route) => {
    expect(new URL(route.request().url()).origin).toBe("http://127.0.0.1:4173");
    await route.continue();
  });
  await page.goto(
    "/auth/callback?error=access_denied&code=fixture-code#access_token=fixture-token",
  );
  await expect(page).toHaveURL("http://127.0.0.1:4173/auth/callback");
  await expect(page.getByRole("alert")).toContainText("Bağlantı tamamlanamadı");
  await expect(page.getByRole("link", { name: "Girişe dön" })).toBeVisible();
  await expect(page.getByText("fixture-token")).toHaveCount(0);
});
