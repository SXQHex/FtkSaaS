import { test, expect } from "./test.js";
import { mockNative, origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import type {
  SuccessOrganizationsList,
  SuccessCentersList,
  SuccessRolesList,
} from "../src/lib/api-contracts/generated.js";
const org = "019a7b00-0000-7000-8000-000000000003",
  center = "019a7b00-0000-7000-8000-000000000004",
  person = "019a7b00-0000-7000-8000-000000000005";
for (const colorScheme of ["light", "dark"] as const)
  test(`ready workspace sidebar and mobile navigation ${colorScheme}`, async ({ page }) => {
    await mockNative(page);
    await page.emulateMedia({ colorScheme });
    await page.route("**/functions/v1/backend-v1/organizations_list_v1", (route) =>
      route.fulfill({
        json: {
          ok: true,
          data: {
            items: [
              {
                id: org,
                name: "Fixture Studio",
                state: "active",
                access_mode: "normal",
                version: 1,
                self_context: { person_id: person, subscriber_number: null, centers: [] },
              },
            ],
            next_cursor: null,
            as_of: "2026-11-14T06:00:00Z",
          },
          trace_id: org,
        } satisfies SuccessOrganizationsList,
      }),
    );
    await page.route("**/functions/v1/backend-v1/centers_list_v1", (route) =>
      route.fulfill({
        json: {
          ok: true,
          data: {
            items: [
              {
                id: center,
                name: "Fixture Center",
                timezone: "Europe/Istanbul",
                state: "active",
                accessible: true,
                version: 1,
              },
            ],
            next_cursor: null,
            as_of: "2026-11-14T06:00:00Z",
          },
          trace_id: org,
        } satisfies SuccessCentersList,
      }),
    );
    await page.route("**/functions/v1/backend-v1/roles_list_v1", (route) => {
      expect(route.request().postDataJSON()).toMatchObject({ org_id: org, person_id: person });
      return route.fulfill({
        json: {
          ok: true,
          data: {
            items: [
              {
                id: person,
                person_id: person,
                role: "owner",
                scope_center_id: null,
                state: "active",
                version: 1,
              },
            ],
            next_cursor: null,
            as_of: "2026-11-14T06:00:00Z",
          },
          trace_id: org,
        } satisfies SuccessRolesList,
      });
    });
    await page.goto(`${origin}/login`);
    await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
    await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/account`);
    await expect(page.getByRole("button", { name: /Fixture Studio Fixture Center/ })).toContainText(
      "Fixture Studio",
    );
    await expect(page.getByRole("button", { name: /Fixture Account Stüdyo sahibi/ })).toContainText(
      "Stüdyo sahibi",
    );
    await expect(page.locator("main")).toHaveCount(1);
    expect((await scanAccessibility(page, "workspace-desktop")).violations).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    const toggle = page.getByRole("button", { name: "Menüyü aç veya kapat", exact: true });
    await toggle.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Ana menü", exact: true });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "Menüyü kapat", exact: true });
    await expect(close).toBeFocused();
    expect((await scanAccessibility(page, "workspace-mobile-drawer")).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await toggle.click();
    await dialog.getByRole("button", { name: /Fixture Studio Fixture Center/ }).click();
    await expect(page.getByRole("menu", { name: /Fixture Studio Fixture Center/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: /Fixture Studio Fixture Center/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await page.setViewportSize({ width: 640, height: 1000 });
    await page.addStyleTag({
      content:
        "html{zoom:2} *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}",
    });
    expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
    expect((await scanAccessibility(page, "workspace-account-reflow")).violations).toEqual([]);
  });
