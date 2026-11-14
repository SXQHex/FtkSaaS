import { test, expect } from "./test.js";
import { mockNative, origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";

for (const colorScheme of ["light", "dark"] as const) {
  for (const scale of [1, 2]) {
    test(`MFA gate, verified read retry and reflow ${scale} ${colorScheme}`, async ({ page }) => {
      const width = 320 * scale;
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const calls = await mockNative(page, true);
      await page.goto("/login");
      await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
      await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
      await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/mfa`);
      expect(calls.account).toBe(0);
      await page.addStyleTag({
        content: `html { zoom: ${scale}; }
        * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
        p { margin-bottom: 2em !important; }`,
      });
      const code = page.getByLabel("Doğrulama kodu");
      const controls = [
        page.getByRole("link", { name: "F FtkSaaS" }),
        code,
        page.getByRole("button", { name: "Doğrula", exact: true }),
        page.getByRole("link", { name: "Girişe dön" }),
      ];
      await controls[0]!.focus();
      for (const [index, control] of controls.entries()) {
        if (index > 0) await page.keyboard.press("Tab");
        await expect(control).toBeFocused();
        await expect(control).toBeInViewport({ ratio: 1 });
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      }
      for (const control of controls.slice(0, -1).reverse()) {
        await page.keyboard.press("Shift+Tab");
        await expect(control).toBeFocused();
        await expect(control).toBeInViewport({ ratio: 1 });
      }
      await code.fill("abc");
      await page.keyboard.press("Enter");
      await expect(code).toHaveAttribute("aria-invalid", "true");
      expect(calls.verify).toBe(0);
      await code.fill("000000");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("alert")).toContainText("Kod doğrulanamadı");
      expect(calls.account).toBe(0);
      expect(calls.verify).toBe(1);
      expect((await scanAccessibility(page, "mfa-provider-denial")).violations).toEqual([]);
      calls.rejectNextAccount = true;
      await code.fill("123456");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("button", { name: "Yeniden dene" })).toBeVisible();
      await expect(code).toHaveCount(0);
      expect(calls.verify).toBe(2);
      expect((await scanAccessibility(page, "mfa-verified-read-failure")).violations).toEqual([]);
      expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
      await page.getByRole("button", { name: "Yeniden dene" }).focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(`${origin}/account`);
      await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
      expect(calls.verify).toBe(2);
    });
  }
}
