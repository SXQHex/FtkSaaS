import { activate, hasTouchInput, submitWithDevice } from "./device-input.js";
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
      await activate(page.getByRole("button", { name: "Giriş yap", exact: true }));
      await expect(page).toHaveURL(`${origin}/mfa`);
      // The URL can change before the MFA form replaces the login form.
      const code = page.getByLabel("Doğrulama kodu");
      const mfa = page.getByRole("main").filter({ has: code });
      await expect(code).toBeVisible();
      expect(calls.account).toBe(0);
      await page.addStyleTag({
        content: `html { zoom: ${scale}; }
        * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
        p { margin-bottom: 2em !important; }`,
      });
      const controls = [
        mfa.getByRole("link", { name: "F FtkSaaS" }),
        code,
        mfa.getByRole("button", { name: "Doğrula", exact: true }),
        mfa.getByRole("link", { name: "Girişe dön" }),
      ];
      const touch = hasTouchInput(page);
      if (!touch) await controls[0]!.focus();
      for (const [index, control] of controls.entries()) {
        if (touch) {
          await control.scrollIntoViewIfNeeded();
        } else {
          if (index > 0) await page.keyboard.press("Tab");
          await expect(control).toBeFocused();
        }
        await expect(control).toBeInViewport({ ratio: 1 });
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      }
      if (!touch) {
        for (const control of controls.slice(0, -1).reverse()) {
          await page.keyboard.press("Shift+Tab");
          await expect(control).toBeFocused();
          await expect(control).toBeInViewport({ ratio: 1 });
        }
      }
      await code.fill("abc");
      await submitWithDevice(mfa.getByRole("button", { name: "Doğrula", exact: true }));
      await expect(code).toHaveAttribute("aria-invalid", "true");
      expect(calls.verify).toBe(0);
      await code.fill("000000");
      await submitWithDevice(mfa.getByRole("button", { name: "Doğrula", exact: true }));
      await expect(page.getByRole("alert")).toContainText("Kod doğrulanamadı");
      expect(calls.account).toBe(0);
      expect(calls.verify).toBe(1);
      expect((await scanAccessibility(page, "mfa-provider-denial")).violations).toEqual([]);
      calls.rejectNextAccount = true;
      await code.fill("123456");
      await submitWithDevice(mfa.getByRole("button", { name: "Doğrula", exact: true }));
      await expect(page.getByRole("button", { name: "Yeniden dene" })).toBeVisible();
      await expect(code).toHaveCount(0);
      expect(calls.verify).toBe(2);
      expect((await scanAccessibility(page, "mfa-verified-read-failure")).violations).toEqual([]);
      expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
      const retry = page.getByRole("button", { name: "Yeniden dene" });
      if (!touch) await retry.focus();
      await submitWithDevice(retry);
      await expect(page).toHaveURL(`${origin}/account`);
      await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
      expect(calls.verify).toBe(2);
    });
  }
}
