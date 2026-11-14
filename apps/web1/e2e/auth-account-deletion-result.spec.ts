import { test, expect } from "./test.js";
import { captureAuth, mockNative, origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import type {
  SuccessAccountDeletePreview,
  SuccessAccountDeleteApply,
  SuccessJobStatusGet,
  FailureEnvelope,
} from "../src/lib/api-contracts/generated.js";
const actor = "019a7b00-0000-7000-8000-000000000001";
const account = "019a7b00-0000-7000-8000-000000000002";
const job = "019a7b00-0000-7000-8000-000000000003";
const preview = {
  id: account,
  token: "private-preview-token",
  scope_hash: "fixture-hash",
  dependencies: { versions: [], policy_hashes: [], permission_hash: "fixture-permission" },
  effects: [],
  blockers: [],
  expires_at: "2026-11-14T12:00:00Z",
};
async function login(page: import("@playwright/test").Page) {
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
}
for (const lostAck of [false, true])
  test(`deletion explicit confirmation, revoked sessions and owned status ${lostAck}`, async ({
    page,
  }, testInfo) => {
    const native = await mockNative(page);
    let applies = 0,
      statuses = 0,
      allowedReads = 0,
      revokedAt = -1;
    const keys: string[] = [];
    const payloads: unknown[] = [];
    await page.route("**/functions/v1/backend-v1/account_delete_preview_v1", (route) =>
      route.fulfill({
        json: { ok: true, data: preview, trace_id: actor } satisfies SuccessAccountDeletePreview,
      }),
    );
    await page.route("**/functions/v1/backend-v1/account_delete_apply_v1", async (route) => {
      applies++;
      if (applies === 1) revokedAt = native.exchange;
      const body = route.request().postDataJSON();
      keys.push(body.operation_key);
      payloads.push(body.preview);
      expect(body.reauth).toBe(route.request().headers().authorization?.slice(7));
      if (lostAck && applies === 1) return route.abort("connectionreset");
      return route.fulfill({
        json: {
          ok: true,
          data: { job_id: job, state: "pending" },
          trace_id: actor,
        } satisfies SuccessAccountDeleteApply,
      });
    });
    await page.route("**/functions/v1/backend-v1/job_status_get_v1", async (route) => {
      statuses++;
      expect(route.request().postDataJSON()).toMatchObject({ org_id: null, job_id: job });
      if (native.exchange <= revokedAt)
        return route.fulfill({
          status: 401,
          json: {
            ok: false,
            error: { code: "AUTH_REQUIRED", retryable: false, trace_id: actor },
          } satisfies FailureEnvelope,
        });
      allowedReads++;
      if (allowedReads === 1)
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            error: { code: "SERVICE_UNAVAILABLE", retryable: true, trace_id: actor },
          } satisfies FailureEnvelope,
        });
      return route.fulfill({
        json: {
          ok: true,
          data: {
            id: job,
            state: "succeeded",
            progress_count: 0,
            total_count: null,
            result_reference: null,
            safe_error_code: null,
            privacy: {
              request_state: "partial",
              completed_at: null,
              pending_scopes: ["auth", "backups"],
              profile_erasure: { state: "completed", policy_version: 1 },
            },
          },
          trace_id: actor,
        } satisfies SuccessJobStatusGet,
      });
    });
    await login(page);
    await expect(page).toHaveURL(`${origin}/account`);
    await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
    await page.getByRole("button", { name: "Silme önizlemesini aç", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Hesabı sil", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Hesabı sil", exact: true }).click();
    await expect(dialog.getByText("Devam etmek için SİL yaz.", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Onaylamak için SİL yaz", { exact: true })).toBeFocused();
    expect(applies).toBe(0);
    await dialog.getByLabel("Onaylamak için SİL yaz", { exact: true }).fill("SİL");
    await dialog.getByLabel("Parola", { exact: true }).fill("Fixture123");
    expect((await scanAccessibility(page, "account-delete-confirmation")).violations).toEqual([]);
    await dialog.getByRole("button", { name: "Hesabı sil", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/account/deletion`);
    expect(applies).toBe(1);
    if (!lostAck) {
      await expect(page.getByRole("alert")).toContainText("Durum okunamadı");
      expect(allowedReads).toBe(0);
      expect(statuses).toBe(1);
      await login(page);
      await expect(page).toHaveURL(`${origin}/account/deletion`);
    } else {
      await expect(
        page.getByRole("button", { name: "Aynı isteği kurtar", exact: true }),
      ).toBeVisible();
      // Reload preserves the exact private intent; loading the page never repeats a write.
      await page.reload();
      expect(applies).toBe(1);
      await login(page);
      await expect(page).toHaveURL(`${origin}/account/deletion`);
      await page.getByRole("button", { name: "Aynı isteği kurtar", exact: true }).click();
      await expect(page.getByRole("button", { name: "Durumu yenile", exact: true })).toBeVisible();
      expect(keys).toHaveLength(2);
      expect(keys[1]).toBe(keys[0]);
      expect(payloads[1]).toEqual(payloads[0]);
    }
    await expect(page.getByRole("alert")).toContainText("Durum okunamadı");
    const readsBefore = native.account;
    await page.getByRole("button", { name: "Durumu yenile", exact: true }).click();
    await expect(page.getByText("Silme süreci kısmen tamamlandı.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Silme tamamlandı", exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText("Yedekler", { exact: true })).toBeVisible();
    expect(native.account).toBe(readsBefore);
    const refresh = page.getByRole("button", { name: "Durumu yenile", exact: true });
    await refresh.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Girişe dön", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(refresh).toBeFocused();
    const reads = statuses,
      writes = applies;
    await page.keyboard.press("Enter");
    await expect.poll(() => statuses).toBe(reads + 1);
    await expect(refresh).toBeEnabled();
    expect(applies).toBe(writes);
    expect(await page.locator("main").innerText()).not.toMatch(/private-preview|019a7b00/);
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width: 640, height: 1000 });
      await page.addStyleTag({
        content:
          "html{zoom:2} *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}",
      });
      expect((await scanAccessibility(page, "account-delete-partial-reflow")).violations).toEqual(
        [],
      );
      expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
    }
    await page.addStyleTag({
      content:
        "html{zoom:1} *{line-height:revert!important;letter-spacing:revert!important;word-spacing:revert!important} p{margin-bottom:revert!important}",
    });
    await captureAuth(page, lostAck ? "e09-recovered" : "e09-result", testInfo);
  });
test("foreign receipt cannot read or recover another account's deletion", async ({ page }) => {
  await mockNative(page);
  let jobs = 0,
    applies = 0;
  await page.addInitScript(
    ({ account, job }) => {
      sessionStorage.setItem(
        "ftk-account-deletion",
        JSON.stringify({
          actor: account,
          operationKey: account,
          preview: { id: account, token: "private-other-token" },
          jobId: job,
        }),
      );
    },
    { account, job },
  );
  await page.route("**/functions/v1/backend-v1/job_status_get_v1", (route) => {
    jobs++;
    return route.abort();
  });
  await page.route("**/functions/v1/backend-v1/account_delete_apply_v1", (route) => {
    applies++;
    return route.abort();
  });
  await login(page);
  await expect(page).toHaveURL(`${origin}/account`);
  await page.goto(`${origin}/account/deletion`);
  await expect(page.getByText(/Durumu görmek için isteği başlattığın hesapla/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Durumu yenile", exact: true })).toHaveCount(0);
  expect(jobs).toBe(0);
  expect(applies).toBe(0);
  expect((await scanAccessibility(page, "account-delete-foreign-receipt")).violations).toEqual([]);
});
