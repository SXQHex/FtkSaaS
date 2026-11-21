import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockNative, openWorkspaceNavigation, origin } from "./auth-fixture.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
async function signIn(page: Page) {
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
}
for (const [code, title] of [
  ["FORBIDDEN", "Bu sayfaya erişimin yok"],
  ["NOT_FOUND", "Sayfa bulunamadı"],
  ["PLAN_FEATURE_UNAVAILABLE", "Plan sınırına ulaşıldı"],
  ["PLAN_LIMIT_REACHED", "Plan sınırına ulaşıldı"],
] as const)
  test(`states native ${code} route failure retains its actual meaning and safe exits`, async ({
    page,
  }) => {
    await mockNative(page);
    await signIn(page);
    await page.route("**/functions/v1/backend-v1/account_get_v1", (route) =>
      route.fulfill({
        status: code === "NOT_FOUND" ? 404 : 403,
        json: { ok: false, error: { code, retryable: false, trace_id: I.role } },
      }),
    );
    await page.goto(`${origin}/help`);
    const heading = page.getByRole("heading", { name: title, exact: true });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByRole("link", { name: "Hesabıma dön", exact: true })).toHaveAttribute(
      "href",
      "/account",
    );
    await expect(page.getByRole("link", { name: "Yardım", exact: true })).toHaveAttribute(
      "href",
      "/help",
    );
    await expect(page.getByRole("button", { name: "Tekrar dene", exact: true })).toHaveCount(0);
    await expect(page.getByText("Henüz kayıt yok", { exact: true })).toHaveCount(0);
    await expect(page.locator("main")).toContainText(I.role);
  });
test("states route transport retry only rereads the failed loader and recovers the actual page", async ({
  page,
}) => {
  await mockNative(page);
  await signIn(page);
  let attempts = 0;
  let transportUnavailable = true;
  await page.route("**/functions/v1/backend-v1/account_get_v1", async (route) => {
    attempts++;
    if (transportUnavailable) return route.abort("failed");
    await route.fallback();
  });
  await page.goto(`${origin}/help`);
  await expect(page.getByRole("heading", { name: "Liste yüklenemedi", exact: true })).toBeVisible();
  const retry = page.getByRole("button", { name: "Tekrar dene", exact: true });
  await retry.focus();
  transportUnavailable = false;
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Yardım", exact: true })).toBeFocused();
  expect(attempts).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("button", { name: "Adresi kopyala", exact: true })).toBeEnabled();
});
test("states native version conflict provides reread and never a force-overwrite action", async ({
  page,
}) => {
  await mockNative(page);
  await signIn(page);
  let conflict = true;
  await page.route("**/functions/v1/backend-v1/account_get_v1", async (route) => {
    if (conflict)
      return route.fulfill({
        status: 409,
        json: {
          ok: false,
          error: { code: "VERSION_CONFLICT", retryable: false, trace_id: I.role },
        },
      });
    await route.fallback();
  });
  await page.goto(`${origin}/help`);
  await expect(
    page.getByRole("heading", { name: "Kayıt başka biri tarafından değiştirildi", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /üzerine yaz/i })).toHaveCount(0);
  conflict = false;
  const reload = page.getByRole("button", { name: "Güncel kaydı yükle", exact: true });
  await reload.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Yardım", exact: true })).toBeFocused();
});
test("states offline notice follows the browser signal without losing the mounted page or replaying a writer", async ({
  page,
  context,
}) => {
  await mockNative(page);
  await signIn(page);
  await page.goto(`${origin}/help`);
  await expect(page.getByRole("heading", { name: "Yardım", exact: true })).toBeVisible();
  const writes: string[] = [];
  page.on("request", (request) => {
    if (/backend-v1\/.*(?:_apply_|_record_|_save_|_publish_|_update_)/.test(request.url()))
      writes.push(request.url());
  });
  await context.setOffline(true);
  await expect(page.getByRole("alert").filter({ hasText: "Bağlantı yok" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adresi kopyala", exact: true })).toBeEnabled();
  await expect(page.locator("[data-slot=accordion-trigger]")).toHaveCount(27);
  await context.setOffline(false);
  await expect(page.getByRole("alert").filter({ hasText: "Bağlantı yok" })).toHaveCount(0);
  expect(writes).toEqual([]);
});
test("states closed organization banner uses the native access mode without assuming a quota or disabling maintenance actions", async ({
  page,
}) => {
  await mockStudio(page);
  await signIn(page);
  await page.route("**/functions/v1/backend-v1/organizations_list_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          items: [
            {
              id: I.org,
              name: "Sentetik merkez sahibi",
              state: "active",
              access_mode: "closed",
              version: 1,
              self_context: { person_id: I.self, subscriber_number: null, centers: [] },
            },
          ],
          next_cursor: null,
          as_of: "2026-11-17T00:00:00Z",
        },
        trace_id: I.role,
      },
    }),
  );
  await page.goto(`${origin}/help`);
  await expect(page.getByRole("status").filter({ hasText: "Panel salt okunur" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adresi kopyala", exact: true })).toBeEnabled();
  await expect(page.locator("main")).not.toContainText("100 / 100");
});

test("states SPA navigation shares account cache while direct URL reload rechecks auth", async ({
  page,
}) => {
  const calls = await mockNative(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Profil", exact: true })).toBeVisible();
  const before = calls.account;
  await page.evaluate(() => {
    (window as Window & { __spaMarker?: boolean }).__spaMarker = true;
  });
  await openWorkspaceNavigation(page);
  await page.getByRole("navigation", { name: "Yardım", exact: true })
    .getByRole("link", { name: "Yardım", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/help`);
  await expect(page.getByRole("heading", { name: "Yardım", exact: true })).toBeVisible();
  expect(await page.evaluate(() =>
    (window as Window & { __spaMarker?: boolean }).__spaMarker,
  )).toBe(true);
  // The first non-platform route creates one ordinary projection. Workspace
  // must reuse it rather than issue its own second account_get_v1 call.
  expect(calls.account - before).toBe(1);
  const afterNavigation = calls.account;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Yardım", exact: true })).toBeVisible();
  expect(calls.account).toBeGreaterThan(afterNavigation);
});
