import { test, expect } from "./test.js";
import { captureAuth, mockNative, origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import type {
  SuccessAccountDeletePreview,
  FailureEnvelope,
} from "../src/lib/api-contracts/generated.js";
const id = "019a7b00-0000-7000-8000-000000000002";
for (const colorScheme of ["light", "dark"] as const)
  for (const scale of [1, 2]) {
    test(`account deletion preview remains read-only ${scale} ${colorScheme}`, async ({ page }) => {
      await mockNative(page);
      let previews = 0,
        applies = 0;
      await page.route("**/functions/v1/backend-v1/account_delete_apply_v1", (route) => {
        applies++;
        return route.abort();
      });
      await page.route("**/functions/v1/backend-v1/account_delete_preview_v1", (route) => {
        previews++;
        if (previews === 1)
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
              id,
              token: "private-preview-token",
              scope_hash: "fixture-hash",
              dependencies: {
                versions: [],
                policy_hashes: [],
                permission_hash: "fixture-permission",
              },
              effects:
                previews >= 3 ? [] : [{ entity: { type: "accounts", id }, action: "delete" }],
              blockers:
                previews >= 3
                  ? []
                  : [{ code: "OWNER_TRANSFER_REQUIRED", retryable: false, trace_id: id }],
              expires_at: "2026-11-14T08:00:00Z",
              lifecycle_impact: {
                active_account_links: 1,
                open_sessions: 0,
                open_requests: 0,
                active_reservations: 2,
                active_event_registrations: 0,
                open_debts: 3,
                student_credit_accounts: 1,
                export_operation: "report_export_start_v1",
                export_requires_scope_check: true,
                export_before_closure: true,
                physical_erasure_complete: false,
              },
            },
            trace_id: id,
          } satisfies SuccessAccountDeletePreview,
        });
      });
      await page.setViewportSize({ width: 320 * scale, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/login");
      await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
      await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
      await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/account`);
      await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
      const trigger = page.getByRole("button", { name: "Silme önizlemesini aç", exact: true });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Hesap silme önizlemesi", exact: true });
      await expect(dialog.getByRole("alert")).toContainText("Önizleme alınamadı");
      const retry = dialog.getByRole("button", { name: "Yeniden dene", exact: true });
      await expect(retry).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(dialog.getByRole("alert")).toContainText(
        "Önce stüdyo sahipliğini devretmelisin",
      );
      const close = dialog.getByRole("button", { name: "Kapat", exact: true });
      await expect(close).toBeFocused();
      await page.addStyleTag({
        content: `html{zoom:${scale}} *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}`,
      });
      await close.scrollIntoViewIfNeeded();
      await expect(close).toBeInViewport({ ratio: 1 });
      const headerClose = dialog.getByRole("button", { name: "Önizlemeyi kapat", exact: true });
      await page.keyboard.press("Tab");
      await expect(headerClose).toBeFocused();
      await expect(headerClose).toBeInViewport({ ratio: 1 });
      const effectsRegion = dialog.getByRole("region", {
        name: "Önizleme etkileri ve engeller",
        exact: true,
      });
      await page.keyboard.press("Tab");
      await expect(effectsRegion).toBeFocused();
      if (scale === 2) {
        expect(await effectsRegion.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
        await page.keyboard.press("PageDown");
        await expect.poll(() => effectsRegion.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
        await page.keyboard.press("Home");
        await expect.poll(() => effectsRegion.evaluate((el) => el.scrollTop)).toBe(0);
      }
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(effectsRegion).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(headerClose).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(close).toBeFocused();
      await expect(
        dialog.getByText("Bu önizleme hesabını değiştirmez.", { exact: true }),
      ).toBeVisible();
      expect(await dialog.innerText()).not.toContain("private-preview-token");
      expect(await dialog.innerText()).not.toContain(id);
      expect((await scanAccessibility(page, "account-delete-blocked-preview")).violations).toEqual(
        [],
      );
      expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
      expect(applies).toBe(0);
      expect(previews).toBe(2);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(dialog.getByRole("status")).toContainText(
        "Önizlemede silmeyi engelleyen bir kayıt bildirilmedi",
      );
      expect(
        (await scanAccessibility(page, "account-delete-unblocked-empty-effects")).violations,
      ).toEqual([]);
      expect(previews).toBe(3);
      expect(applies).toBe(0);
      await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
      await expect(trigger).toBeFocused();
    });
  }
test("account deletion blocked preview visual composition", async ({ page }, testInfo) => {
  await mockNative(page);
  await page.route("**/functions/v1/backend-v1/account_delete_preview_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          id,
          token: "private-preview-token",
          scope_hash: "fixture-hash",
          dependencies: { versions: [], policy_hashes: [], permission_hash: "fixture-permission" },
          effects: [{ entity: { type: "accounts", id }, action: "delete" }],
          blockers: [{ code: "OWNER_TRANSFER_REQUIRED", retryable: false, trace_id: id }],
          expires_at: "2026-11-14T08:00:00Z",
          lifecycle_impact: {
            active_account_links: 1,
            open_sessions: 0,
            open_requests: 0,
            active_reservations: 0,
            active_event_registrations: 0,
            open_debts: 0,
            student_credit_accounts: 0,
            export_operation: "report_export_start_v1",
            export_requires_scope_check: true,
            export_before_closure: true,
            physical_erasure_complete: false,
          },
        },
        trace_id: id,
      } satisfies SuccessAccountDeletePreview,
    }),
  );
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
  await page.getByRole("button", { name: "Silme önizlemesini aç", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Hesap silme önizlemesi", exact: true });
  await expect(dialog.getByRole("alert")).toContainText("Önce stüdyo sahipliğini devretmelisin");
  await captureAuth(
    page,
    "e09-preview",
    testInfo,
    dialog.getByRole("button", { name: "Kapat", exact: true }),
  );
});
