import { test, expect } from "./test.js";
import { scanAccessibility } from "./accessibility.js";

for (const colorScheme of ["light", "dark"] as const) {
  for (const scale of [1, 2]) {
    test(`signup reflow, spacing and keyboard ${scale} ${colorScheme}`, async ({
      page,
      context,
    }) => {
      const width = 320 * scale;
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await context.route("**/*", async (route) => {
        expect(new URL(route.request().url()).origin).toBe("http://127.0.0.1:4173");
        await route.continue();
      });
      await page.goto("/signup");
      await page.addStyleTag({
        content: `html { zoom: ${scale}; }
        * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
        p { margin-bottom: 2em !important; }`,
      });
      const controls = [
        page.getByRole("link", { name: "FtkSaaS", exact: true }),
        page.getByLabel("Ad soyad", { exact: true }),
        page.getByLabel("E-posta", { exact: true }),
        page.getByLabel("Parola", { exact: true }),
        page.getByLabel("Parola tekrar", { exact: true }),
        page.getByRole("button", { name: "Hesap oluştur", exact: true }),
        page.getByRole("button", { name: "Google ile kayıt ol", exact: true }),
        page.getByRole("link", { name: "Giriş yap", exact: true }),
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
      expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
      expect(
        (await scanAccessibility(page, `signup-scale-${scale}-text-spacing`)).violations,
      ).toEqual([]);
      await page.getByLabel("Ad soyad", { exact: true }).fill("Test Student");
      await page.getByLabel("E-posta", { exact: true }).fill("invalid");
      await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
      await page.getByLabel("Parola tekrar", { exact: true }).fill("Fixture123");
      await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
      await expect(page.getByLabel("E-posta", { exact: true })).toBeFocused();
      await expect(page.getByLabel("E-posta", { exact: true })).toBeInViewport({ ratio: 1 });
      expect(
        await page.evaluate(
          "({typeMismatch:document.querySelector('#email').validity.typeMismatch,message:document.querySelector('#email').validationMessage.length>0})",
        ),
      ).toEqual({ typeMismatch: true, message: true });
      await expect(page).toHaveURL("http://127.0.0.1:4173/signup");
    });
  }
}
