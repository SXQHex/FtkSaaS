import { test, expect } from "./test.js";
import { captureAuth, mockNative, origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import type {
  FailureEnvelope,
  SuccessAccountAccessAccept,
  SuccessOperationStatusGet,
  SuccessOrganizationsList,
  SuccessCentersList,
} from "../src/lib/api-contracts/generated.js";
const id = "019a7b00-0000-7000-8000-000000000001";

for (const colorScheme of ["light", "dark"] as const) {
  for (const scale of [1, 2]) {
    test(`invitation preserves auth, uncertain intent and read-only retry ${scale} ${colorScheme}`, async ({
      page,
    }) => {
      await mockNative(page);
      const writes: Record<string, unknown>[] = [];
      let statusReads = 0,
        orgReads = 0,
        centerReads = 0;
      await page.route("**/functions/v1/backend-v1/account_access_accept_v1", async (route) => {
        const body = route.request().postDataJSON();
        writes.push(body);
        if (writes.length === 1)
          return route.fulfill({
            status: 503,
            json: {
              ok: false,
              error: { code: "SERVICE_UNAVAILABLE", retryable: true, trace_id: id },
            } satisfies FailureEnvelope,
          });
        return route.fulfill({
          json: {
            ok: true,
            data: { operation_id: id, primary_id: id, replayed: true, related: [] },
            trace_id: id,
          } satisfies SuccessAccountAccessAccept,
        });
      });
      await page.route("**/functions/v1/backend-v1/operation_status_get_v1", async (route) => {
        const body = route.request().postDataJSON();
        statusReads++;
        expect(body).not.toHaveProperty("token");
        expect(body.key).toBe(writes[0]!.operation_key);
        if (statusReads === 1)
          return route.fulfill({
            json: {
              ok: true,
              data: {
                operation: "account_access_accept_v1",
                key: body.key,
                status: "in_progress",
                result_available: false,
                result_reference: null,
              },
              trace_id: id,
            } satisfies SuccessOperationStatusGet,
          });
        return route.fulfill({
          status: 404,
          json: {
            ok: false,
            error: { code: "NOT_FOUND", retryable: false, trace_id: id },
          } satisfies FailureEnvelope,
        });
      });
      await page.route("**/functions/v1/backend-v1/organizations_list_v1", async (route) => {
        orgReads++;
        if (orgReads === 1)
          return route.fulfill({
            status: 503,
            json: {
              ok: false,
              error: { code: "SERVICE_UNAVAILABLE", retryable: true, trace_id: id },
            } satisfies FailureEnvelope,
          });
        return route.fulfill({
          json: {
            ok: true,
            data: {
              items: [
                { id, name: "Fixture Studio", state: "active", access_mode: "normal", version: 1 },
              ],
              next_cursor: null,
              as_of: "2026-11-14T00:00:00Z",
            },
            trace_id: id,
          } satisfies SuccessOrganizationsList,
        });
      });
      await page.route("**/functions/v1/backend-v1/centers_list_v1", async (route) => {
        centerReads++;
        expect(route.request().postDataJSON().org_id).toBe(id);
        return route.fulfill({
          json: {
            ok: true,
            data: {
              items: [
                {
                  id,
                  name: "Fixture Center",
                  timezone: "Europe/Istanbul",
                  state: "active",
                  accessible: true,
                  version: 1,
                },
              ],
              next_cursor: null,
              as_of: "2026-11-14T00:00:00Z",
            },
            trace_id: id,
          } satisfies SuccessCentersList,
        });
      });
      const width = 320 * scale;
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/invite");
      await expect(page.getByText("Davet bağlantısı bulunamadı.", { exact: false })).toBeVisible();
      await page.goto("/invite#token=fixture-invitation");
      await expect(page).toHaveURL(`${origin}/invite`);
      await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/login`);
      await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
      await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
      await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/invite`);
      expect(writes).toHaveLength(0);
      await expect(page.getByLabel("E-posta", { exact: true })).toHaveValue(
        "fixture@example.invalid",
      );
      await expect(page.getByLabel("Ad soyad", { exact: true })).toHaveValue("Fixture Account");
      await page.addStyleTag({
        content: `html{zoom:${scale}} *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}`,
      });
      const controls = [
        page.getByRole("link", { name: "F FtkSaaS" }),
        page.getByLabel("E-posta", { exact: true }),
        page.getByLabel("Ad soyad", { exact: true }),
        page.getByRole("button", { name: "Daveti kabul et", exact: true }),
        page.getByRole("button", { name: "Başka hesapla giriş yap", exact: true }),
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
      await controls[3]!.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("alert")).toContainText("Kabul sonucu henüz doğrulanamadı");
      expect(writes).toHaveLength(1);
      await page.goto("/invite#token=fixture-other-invitation");
      await expect(page).toHaveURL(`${origin}/invite`);
      await expect(
        page.getByRole("alert").filter({ hasText: "Bu ekrandaki işlemler önceki davete aittir" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Durumu kontrol et" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "İşlem sürüyor" })).toBeVisible();
      expect(writes).toHaveLength(1);
      await page.getByRole("button", { name: "Durumu kontrol et" }).click();
      await page.getByRole("button", { name: "Aynı kabulü yeniden dene" }).click();
      await expect(
        page.getByRole("alert").filter({ hasText: "Kabul tamamlandı; güncel erişim okunamadı" }),
      ).toBeVisible();
      expect(writes).toHaveLength(2);
      expect(writes[0]!.token).toBe("fixture-invitation");
      expect(writes[1]!.operation_key).toBe(writes[0]!.operation_key);
      expect(writes[1]!.request_id).not.toBe(writes[0]!.request_id);
      expect((await scanAccessibility(page, "invite-read-retry")).violations).toEqual([]);
      await page.getByRole("button", { name: "Erişimi yenile" }).click();
      await expect(page.getByRole("status")).toContainText("Davet kabul edildi");
      await expect(page.getByText("Fixture Center", { exact: true })).toBeVisible();
      expect(centerReads).toBe(1);
      expect(writes).toHaveLength(2);
      expect((await scanAccessibility(page, "invite-accepted")).violations).toEqual([]);
      expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
      await page.reload();
      await page.getByRole("button", { name: "Erişimi yenile" }).click();
      await expect(page.getByRole("status")).toContainText("Davet kabul edildi");
      expect(writes).toHaveLength(2);
      expect(centerReads).toBe(2);
    });
  }
}

test("invitation visual composition", async ({ page }, testInfo) => {
  await mockNative(page);
  await page.goto("/invite#token=fixture-visual-invitation");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.getByLabel("Ad soyad", { exact: true })).toHaveValue("Fixture Account");
  await captureAuth(page, "e07", testInfo);
});
