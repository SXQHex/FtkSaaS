import { test, expect } from "./test.js";
import { captureAuth, mockNative, origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import type { FailureEnvelope } from "../src/lib/api-contracts/generated.js";

for (const colorScheme of ["light", "dark"] as const) {
  for (const scale of [1, 2]) {
    test(`unavailable invitation recovery ${scale} ${colorScheme}`, async ({ page }) => {
      await mockNative(page);
      let writes = 0;
      await page.route("**/functions/v1/backend-v1/account_access_accept_v1", (route) => {
        writes++;
        return route.fulfill({
          json: {
            ok: false,
            error: {
              code: "INVITATION_UNAVAILABLE",
              retryable: false,
              trace_id: "019a7b00-0000-7000-8000-000000000001",
            },
          } satisfies FailureEnvelope,
        });
      });
      await page.setViewportSize({ width: 320 * scale, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/invite/expired");
      await expect(
        page.getByRole("heading", { name: "Bu davet kullanılamıyor", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Yeni bağlantı gerekiyorsa stüdyoyla iletişime geç.", { exact: false }),
      ).toBeVisible();
      expect(writes).toBe(0);
      await page.addStyleTag({
        content: `html{zoom:${scale}} *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}`,
      });
      const controls = [
        page.getByRole("link", { name: "F FtkSaaS" }),
        page.getByRole("link", { name: "Doğru hesabı kontrol et", exact: true }),
        page.getByRole("link", { name: "Girişe dön", exact: true }),
      ];
      await controls[0]!.focus();
      for (const [index, control] of controls.entries()) {
        if (index > 0) await page.keyboard.press("Tab");
        await expect(control).toBeFocused();
        await expect(control).toBeInViewport({ ratio: 1 });
      }
      for (const control of controls.slice(0, -1).reverse()) {
        await page.keyboard.press("Shift+Tab");
        await expect(control).toBeFocused();
      }
      expect((await scanAccessibility(page, "invitation-unavailable")).violations).toEqual([]);
      expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
      await controls[1]!.click();
      await expect(page).toHaveURL(`${origin}/invite`);
      expect(writes).toBe(0);
      await page.goto("/login");
      await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
      await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
      await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/account`);
      await page.goto("/invite#token=fixture-unavailable");
      await page.getByRole("button", { name: "Daveti kabul et", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText("Davet kullanılamıyor");
      await page.getByRole("link", { name: "Bağlantı hakkında yardım", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/invite/expired`);
      await expect(
        page.getByRole("heading", { name: "Bu davet kullanılamıyor", exact: true }),
      ).toBeVisible();
      expect(writes).toBe(1);
      await page.getByRole("link", { name: "Doğru hesabı kontrol et", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/invite`);
      await expect(page.getByLabel("E-posta", { exact: true })).toHaveValue(
        "fixture@example.invalid",
      );
      expect(writes).toBe(1);
    });
  }
}
test("unavailable invitation visual composition", async ({ page }, testInfo) => {
  await mockNative(page);
  await page.goto("/invite/expired");
  await captureAuth(page, "e08", testInfo);
});
