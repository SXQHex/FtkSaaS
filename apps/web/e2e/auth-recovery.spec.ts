import { test, expect } from "./test.js";
import { mockNative, origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";

for (const colorScheme of ["light", "dark"] as const) {
  for (const scale of [1, 2]) {
    test(`recovery validation, retry and reflow ${scale} ${colorScheme}`, async ({ page }) => {
      const width = 320 * scale;
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await mockNative(page);
      let attempts = 0;
      await page.route("**/auth/v1/recover*", async (route) => {
        attempts++;
        expect(route.request().postDataJSON()).toMatchObject({ email: "fixture@example.invalid" });
        expect(new URL(route.request().url()).searchParams.get("redirect_to")).toBe(
          `${origin}/auth/callback?next=/reset-password`,
        );
        return attempts === 1
          ? route.fulfill({
              status: 429,
              json: { code: "over_email_send_rate_limit", msg: "Rate limited" },
            })
          : route.fulfill({ json: {} });
      });
      await page.goto("/forgot-password");
      await page.addStyleTag({
        content: `html { zoom: ${scale}; }
        * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
        p { margin-bottom: 2em !important; }`,
      });
      const email = page.getByLabel("E-posta", { exact: true });
      const controls = [
        page.getByRole("link", { name: "F FtkSaaS" }),
        email,
        page.getByRole("button", { name: "Bağlantı gönder" }),
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
      await email.fill("invalid");
      await page.keyboard.press("Enter");
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await expect(email).toHaveAccessibleDescription("Geçerli bir e-posta adresi gir.");
      expect(attempts).toBe(0);
      await email.fill("fixture@example.invalid");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(email).toHaveValue("fixture@example.invalid");
      expect(attempts).toBe(1);
      expect((await scanAccessibility(page, "recovery-provider-rate-limit")).violations).toEqual(
        [],
      );
      await email.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: "E-postanı kontrol et" })).toBeVisible();
      await expect(page.getByRole("status")).toContainText("Adres uygunsa");
      expect(attempts).toBe(2);
      expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
      expect((await scanAccessibility(page, "recovery-neutral-result")).violations).toEqual([]);
    });
  }
}
