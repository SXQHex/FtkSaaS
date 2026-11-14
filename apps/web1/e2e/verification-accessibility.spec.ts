import { test, expect } from "./test.js";
import { scanAccessibility } from "./accessibility.js";

for (const colorScheme of ["light", "dark"] as const) {
  for (const scale of [1, 2]) {
    test(`verification reflow and keyboard ${scale} ${colorScheme}`, async ({ page, context }) => {
      const width = 320 * scale;
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await context.route("**/*", async (route) => {
        expect(new URL(route.request().url()).origin).toBe("http://127.0.0.1:4173");
        await route.continue();
      });
      await page.goto("/verify-email");
      await page.addStyleTag({
        content: `html { zoom: ${scale}; }
        * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
        p { margin-bottom: 2em !important; }`,
      });
      const resend = page.getByRole("button", { name: "Yeniden gönder" });
      await resend.focus();
      await page.keyboard.press("Enter");
      const email = page.getByLabel("E-posta", { exact: true });
      await expect(email).toBeFocused();
      const controls = [
        page.getByRole("link", { name: "F FtkSaaS" }),
        email,
        resend,
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
      await expect(email).toBeFocused();
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await expect(email).toHaveAccessibleDescription("Geçerli bir e-posta adresi gir.");
      expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
      expect(
        (await scanAccessibility(page, "verification-expanded-invalid-email")).violations,
      ).toEqual([]);
    });
  }
}
