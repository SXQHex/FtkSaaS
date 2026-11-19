import { test, expect } from "./test.js";
import { mockNative, origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import { assertLayoutFit, readLayoutFit } from "./layout.js";
import { mockStudio, openStudio } from "./studio-fixture.js";
import type {
  SuccessOrganizationsList,
  SuccessCentersList,
  SuccessRolesList,
} from "../src/lib/api-contracts/generated.js";
const org = "019a7b00-0000-7000-8000-000000000003",
  center = "019a7b00-0000-7000-8000-000000000004",
  person = "019a7b00-0000-7000-8000-000000000005";

const shellViewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 400, height: 844 },
  { width: 320, height: 844 },
];

test("command palette reaches appearance, switches the saved theme and signs out", async ({
  page,
}) => {
  const { native } = await mockStudio(page);
  await page.emulateMedia({ colorScheme: "light" });
  await openStudio(page);
  const search = page.getByRole("button", { name: "Ara… Ctrl K", exact: true });
  const input = page.getByPlaceholder("Sayfa adı ara…");
  await search.click();
  await input.fill("Temayı değiştir");
  await page.getByRole("menuitem", { name: "Temayı değiştir", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account#account-appearance`);
  const appearance = page.locator("#account-appearance");
  await expect(appearance.getByRole("radiogroup", { name: "Tema", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Temayı değiştir", exact: true })).toBeEnabled();
  await search.click();
  await input.fill("Temayı değiştir");
  await page.getByRole("menuitem", { name: "Temayı değiştir", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(native.settingsPatches).toEqual([{ theme: "dark" }]);
  await search.click();
  await input.fill("Çıkış yap");
  await page.getByRole("menuitem", { name: "Çıkış yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/login`);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
});
for (const colorScheme of ["light", "dark"] as const)
  test(`ready workspace sidebar and mobile navigation ${colorScheme}`, async ({ page }) => {
    await mockNative(page);
    await page.setViewportSize(shellViewports[0]!);
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
    const rail = page.locator('[data-slot="sidebar-rail"]');
    await expect(rail).toBeVisible();
    expect((await rail.boundingBox())?.width).toBeGreaterThanOrEqual(24);
    await rail.click();
    await expect(page.locator('[data-slot="sidebar"][data-state="collapsed"]')).toBeVisible();
    await rail.click();
    await expect(page.locator('[data-slot="sidebar"][data-state="expanded"]')).toBeVisible();
    for (const viewport of shellViewports) {
      await page.setViewportSize(viewport);
      expect(
        (await scanAccessibility(page, `workspace-${viewport.width}-${colorScheme}`)).violations,
      ).toEqual([]);
      assertLayoutFit(await readLayoutFit(page));
      await page.screenshot({ path: `.tmp/v67-shell-app-${viewport.width}-${colorScheme}.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const toggle = page.getByRole("button", { name: "Menüyü aç veya kapat", exact: true });
    await toggle.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Ana menü", exact: true });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "Menüyü kapat", exact: true });
    await expect(close).toBeFocused();
    await expect(close).toHaveCSS("box-shadow", /^(?!none$).+/);
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

test("Starter self management opens the native owner navigation and removes it after scope revocation", async ({
  page,
}) => {
  await mockStudio(page);
  let scope: { owner: boolean; org_manager: boolean; managed_center_ids: string[] } | null = {
    owner: true,
    org_manager: false,
    managed_center_ids: [center],
  };
  await page.route("**/functions/v1/backend-v1/organizations_list_v1", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ include_self_management_scope: true });
    return route.fulfill({
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
              self_management_scope: scope,
            },
          ],
          next_cursor: null,
          as_of: "2026-11-18T06:00:00Z",
        },
        trace_id: org,
      } satisfies SuccessOrganizationsList,
    });
  });
  await page.route("**/functions/v1/backend-v1/roles_list_v1", (route) =>
    route.fulfill({
      json: {
        ok: false,
        error: { code: "PLAN_FEATURE_UNAVAILABLE", retryable: false, trace_id: org },
      },
    }),
  );
  await page.route("**/functions/v1/backend-v1/subscription_get_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          state: "active",
          plan: "starter",
          period_start: null,
          period_end: null,
          grace_until: null,
          cancel_at_period_end: false,
          pending_change: null,
          limits: { entries: [] },
          usage: { entries: [] },
        },
        trace_id: org,
      },
    }),
  );
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  const studio = page.locator("nav a[href$='/studio']");
  await expect(studio).toBeVisible();
  await expect(page.getByRole("button", { name: /Stüdyo sahibi/ })).toBeVisible();
  await expect(
    page.locator("nav a[href$='/events'], nav a[href$='/earnings'], nav a[href$='/automation']"),
  ).toHaveCount(0);
  for (const path of ["leads", "finance", "reports"]) {
    await expect(page.locator(`nav a[href$='/${path}']`)).toBeVisible();
  }
  await page.getByRole("button", { name: "Ara… Ctrl K", exact: true }).click();
  const palette = page.getByRole("dialog", { name: "Sayfalarda ara", exact: true });
  await palette.getByPlaceholder("Sayfa adı ara…").fill("Otomasyon");
  await expect(palette.getByRole("menuitem", { name: "Otomasyon", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  scope = null;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  await expect(studio).toHaveCount(0);
  await page.getByRole("button", { name: "Ara… Ctrl K", exact: true }).click();
  await palette.getByPlaceholder("Sayfa adı ara…").fill("Politikalar");
  await expect(palette.getByText("Eşleşen sayfa yok.", { exact: true })).toBeVisible();
  await expect(palette.getByRole("menuitem", { name: "Politikalar", exact: true })).toHaveCount(0);
});

test("workspace entry offers authorized studios and keeps the selected center on the next screen", async ({
  page,
}) => {
  await mockNative(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const closedOrg = "019a7b00-0000-7000-8000-000000000015";
  const otherCenter = "019a7b00-0000-7000-8000-000000000016";
  const unreadableCenter = "019a7b00-0000-7000-8000-000000000017";
  const orgReads: string[] = [];
  const listed = { version: 1, state: "active" as const };
  const pagination = { next_cursor: null, as_of: "2026-11-14T06:00:00Z" };
  await page.route("**/functions/v1/backend-v1/organizations_list_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        trace_id: org,
        data: {
          ...pagination,
          items: [
            {
              ...listed,
              id: org,
              name: "Açık stüdyo",
              access_mode: "normal",
              self_context: { person_id: person, subscriber_number: null, centers: [] },
            },
            { ...listed, id: closedOrg, name: "Askıdaki stüdyo", access_mode: "closed" },
          ],
        },
      } satisfies SuccessOrganizationsList,
    }),
  );
  await page.route("**/functions/v1/backend-v1/centers_list_v1", (route) => {
    const request = route.request().postDataJSON() as { org_id: string };
    orgReads.push(request.org_id);
    return route.fulfill({
      json: {
        ok: true,
        trace_id: org,
        data: {
          ...pagination,
          items: [
            { id: center, name: "İlk merkez", accessible: true },
            { id: otherCenter, name: "Seçilen merkez", accessible: true },
            { id: unreadableCenter, name: "Yetkisiz merkez", accessible: false },
          ].map((item) => ({ ...listed, timezone: "Europe/Istanbul", ...item })),
        },
      } satisfies SuccessCentersList,
    });
  });
  await page.route("**/functions/v1/backend-v1/roles_list_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        trace_id: org,
        data: {
          ...pagination,
          items: [
            {
              ...listed,
              id: person,
              person_id: person,
              role: "owner",
              scope_center_id: null,
            },
          ],
        },
      } satisfies SuccessRolesList,
    }),
  );
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  const studioHeading = page.getByRole("heading", { name: "Hangi stüdyoyla devam edeceksin?" });
  await expect(studioHeading).toBeFocused();
  await expect(page.getByRole("radio", { name: /Askıdaki stüdyo/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Devam et", exact: true })).toBeDisabled();
  await page.getByRole("radio", { name: "Açık stüdyo", exact: true }).check();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Çalışacağın merkezi seç" })).toBeFocused();
  await expect(page.getByRole("radio", { name: "Yetkisiz merkez" })).toHaveCount(0);
  await page.getByRole("button", { name: "Stüdyo seçimine dön" }).click();
  await expect(studioHeading).toBeFocused();
  await page.getByRole("radio", { name: "Açık stüdyo", exact: true }).check();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  const selected = page.getByRole("radio", { name: "Seçilen merkez", exact: true });
  await selected.focus();
  await page.keyboard.press("Space");
  expect((await scanAccessibility(page, "workspace-entry-center")).violations).toEqual([]);
  assertLayoutFit(await readLayoutFit(page));
  await page.getByRole("button", { name: "Merkezi aç" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Menüyü aç veya kapat" }).click();
  await expect(page.getByRole("button", { name: /Açık stüdyo Seçilen merkez/ })).toBeVisible();
  const links = await page
    .locator("a")
    .evaluateAll((items) => items.map((item) => item.getAttribute("href")));
  expect(links.some((href) => href?.startsWith(`/o/${org}/c/${otherCenter}/`))).toBe(true);
  expect(orgReads).toContain(org);
  expect(orgReads).not.toContain(closedOrg);
});
