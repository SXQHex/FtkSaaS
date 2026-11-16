import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const id = "019ab7b0-0000-7000-8000-000000000201";
async function fixture(
  page: Page,
  mode: "normal" | "unknown" | "unread" | "denied" | "stale" = "normal",
) {
  await mockStudio(page);
  const state = {
    read: false,
    version: 7,
    writes: [] as Record<string, unknown>[],
    lists: [] as Record<string, unknown>[],
    effects: 0,
    failResult: false,
    denied: mode === "denied",
    advanced: false,
  };
  const row = () => ({
    id,
    kind: "private_native_kind",
    payload: {
      template_key: "private_native_template",
      subject: { type: "notifications", id },
      title: "Örnek bildirim",
      body: '<img src=x onerror="alert(1)"> Gönderim durumu güncellendi.',
      language: "tr",
    },
    created_at: "2026-11-16T12:00:00Z",
    read_at: state.read ? "2026-11-16T12:05:00Z" : null,
    email_job: {
      id: I.role,
      state: "succeeded",
      progress_count: 1,
      total_count: 1,
      result_reference: null,
      safe_error_code: null,
      email_delivery: { state: "delayed", occurred_at: "2026-11-16T12:02:00Z" },
    },
  });
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const reject = (code: string, retryable = false) =>
      route.fulfill({
        status: retryable ? 503 : 403,
        json: { ok: false, error: { code, retryable, trace_id: I.role } },
      });
    if (op === "notifications_list_v1") {
      expect(r.org_id).toBe(I.org);
      expect(r).not.toHaveProperty("person_id");
      state.lists.push(r);
      if (state.denied) return reject("FORBIDDEN");
      return send({
        items: r.unread_only && state.read ? [] : [row()],
        next_cursor: null,
        as_of: "2026-11-16T12:05:00Z",
      });
    }
    if (op === "management_state_get_v1" && r.operation === "notification_mark_read_v1") {
      if (state.failResult) {
        state.failResult = false;
        return reject("SERVICE_UNAVAILABLE", true);
      }
      if (mode === "stale" && !state.advanced && state.lists.length) {
        state.advanced = true;
      } else if (mode === "stale" && state.advanced && !state.writes.length) state.version = 8;
      return send({
        items: [
          {
            operation: r.operation,
            exists: true,
            entity: { type: "notifications", id },
            state: state.read ? "read" : "unread",
            versions: [{ entity: { type: "notifications", id }, version: state.version }],
            current: { operation: r.operation, values: { notification_id: id } },
          },
        ],
        next_cursor: null,
        as_of: "2026-11-16T12:05:00Z",
      });
    }
    if (op === "notification_mark_read_v1") {
      state.writes.push(r);
      expect(r.notification_id).toBe(id);
      if (!state.effects) {
        expect(r.expected_version).toBe(7);
        state.effects++;
        state.version++;
        state.read = true;
        if (mode === "unknown") return route.abort("failed");
        if (mode === "unread") state.failResult = true;
      }
      return send({
        operation_id: I.role,
        primary_id: id,
        version: state.version,
        replayed: false,
        related: [],
      });
    }
    if (op === "operation_status_get_v1" && r.operation === "notification_mark_read_v1")
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: "notifications", id },
      });
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.goto(`${origin}/inbox?org=${I.org}&center=${I.center}`);
  await expect(page.getByRole("heading", { name: "Gelen kutusu", exact: true })).toBeVisible();
  return state;
}
test("inbox shows native copy safely, keeps unsupported actions disabled, and restores mobile list focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await fixture(page);
  await expect(page.getByRole("searchbox", { name: "İletilerde ara", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Tümünü okundu yap", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Örnek bildirim", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Örnek bildirim", exact: true })).toBeFocused();
  await expect(page.locator("aside img")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "İleti ayrıntısı" })).toContainText(
    "Gecikti",
  );
  await expect(page.getByRole("button", { name: "Yanıtla", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Gelen kutusu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Örnek bildirim", exact: true })).toBeFocused();
  expect(state.writes).toHaveLength(0);
});
test("inbox unread filter stays native and a reviewed click uses actual version before read-state confirmation", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("radio", { name: "Okunmamış", exact: true }).click();
  await page.getByRole("button", { name: "Örnek bildirim", exact: true }).click();
  await page.getByRole("button", { name: "Okundu yap", exact: true }).click();
  await expect(
    page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes[0]).toMatchObject({ expected_version: 7, notification_id: id });
  expect(state.lists.some((r) => r.unread_only === true)).toBe(true);
  await expect(page.getByRole("button", { name: "Okunmadı yap", exact: true })).toBeDisabled();
});
test("inbox unknown write recovers its exact receipt and never marks twice", async ({ page }) => {
  const state = await fixture(page, "unknown");
  await page.getByRole("button", { name: "Örnek bildirim", exact: true }).click();
  await page.getByRole("button", { name: "Okundu yap", exact: true }).click();
  await expect(page.getByText(/Sonuç bilinmiyor/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Tümü", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.effects).toBe(1);
});
test("inbox acknowledged result failure retries only the original result read", async ({
  page,
}) => {
  const state = await fixture(page, "unread");
  await page.getByRole("button", { name: "Örnek bildirim", exact: true }).click();
  await page.getByRole("button", { name: "Okundu yap", exact: true }).click();
  await expect(page.getByText(/güncel sonuç henüz okunamadı/)).toBeVisible();
  await page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("inbox source denial remains unknown and recovers only on explicit retry", async ({
  page,
}) => {
  const state = await fixture(page, "denied");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Bildirim kaynağı okunamadı. Güncel yetkili kaynağı yeniden oku." }),
  ).toBeVisible();
  await expect(page.getByText("Bu kapsamda görünür ileti yok.", { exact: true })).toHaveCount(0);
  state.denied = false;
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.getByRole("button", { name: "Örnek bildirim", exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("inbox changed native version is reread before any new writer", async ({ page }) => {
  const state = await fixture(page, "stale");
  await page.getByRole("button", { name: "Örnek bildirim", exact: true }).click();
  await page.getByRole("button", { name: "Okundu yap", exact: true }).click();
  await expect(page.getByText(/Önizleme veya kaynak değişti/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("inbox global entry resolves its native workspace before enabling the scoped content", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(`${origin}/inbox`);
  await expect(page).toHaveURL(`${origin}/inbox?org=${I.org}&center=${I.center}`);
  await expect(page.getByRole("button", { name: "Örnek bildirim", exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
