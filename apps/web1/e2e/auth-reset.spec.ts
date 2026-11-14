import { test, expect } from "./test.js";
import { origin, mockNative } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";

for (const colorScheme of ["light", "dark"] as const) {
  for (const scale of [1, 2]) {
    test(`recovery password confirmation, replay guard and reflow ${scale} ${colorScheme}`, async ({
      page,
    }) => {
      const width = 320 * scale;
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const calls = await mockNative(page);
      await page.goto("/forgot-password");
      await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
      await page.getByRole("button", { name: "Bağlantı gönder" }).click();
      await expect(page.getByRole("heading", { name: "E-postanı kontrol et" })).toBeVisible();
      await page.goto("/auth/callback?code=fixture-recovery-code&next=/reset-password");
      await expect(page).toHaveURL(`${origin}/reset-password`);
      await page.addStyleTag({
        content: `html { zoom: ${scale}; }
        * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
        p { margin-bottom: 2em !important; }`,
      });
      const password = page.getByLabel("Yeni parola", { exact: true });
      const confirm = page.getByLabel("Parola tekrar", { exact: true });
      const controls = [
        page.getByRole("link", { name: "F FtkSaaS" }),
        password,
        confirm,
        page.getByRole("button", { name: "Parolayı kaydet" }),
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
      await password.fill("Fixture123");
      await confirm.fill("Different123");
      await page.keyboard.press("Enter");
      await expect(confirm).toHaveAttribute("aria-invalid", "true");
      await expect(confirm).toHaveAccessibleDescription("Parolalar eşleşmiyor.");
      expect(calls.password).toBe(0);
      expect((await scanAccessibility(page, "recovery-password-mismatch")).violations).toEqual([]);
      await confirm.fill("Fixture123");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("status")).toContainText("Parolan kaydedildi.");
      expect(calls.exchange).toBe(1);
      expect(calls.password).toBe(1);
      expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
      expect((await scanAccessibility(page, "recovery-password-saved")).violations).toEqual([]);
      await page.goto("/reset-password");
      await expect(page).toHaveURL(`${origin}/forgot-password`);
    });
  }
}
