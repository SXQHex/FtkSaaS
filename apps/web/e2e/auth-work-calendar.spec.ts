import { test, expect } from "./test.js";
import { mockStudio, openStudio, studioIds as I } from "./studio-fixture.js";
import type { CenterWorkCalendar } from "@ftksaas/api-contracts";
import { scanAccessibility } from "./accessibility.js";
async function fixture(page: import("@playwright/test").Page) {
  const studio = await mockStudio(page);
  studio.roles[0]!.accountAccessGranted = true;
  const state = {
    version: 1,
    calendar: null as CenterWorkCalendar | null,
    impact: 0,
    writable: true,
    lost: false,
    failedReads: 0,
    afterAckFail: false,
    writes: [] as Record<string, unknown>[],
    effects: 0,
    previews: 0,
  };
  const receipts = new Map<string, Record<string, unknown>>();
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const fail = (code: string, status = 409) =>
      route.fulfill({
        status,
        json: { ok: false, error: { code, retryable: status === 503, trace_id: I.role } },
      });
    if (op === "roles_list_v1")
      return send({
        items: [
          {
            id: I.role,
            person_id: I.self,
            role: "center_manager",
            scope_center_id: I.center,
            state: "active",
            version: 1,
          },
        ],
        next_cursor: null,
      });
    if (op === "settings_catalog_get_v1" && r.scope !== "user")
      return send({
        scope: r.scope,
        catalog_version: 24,
        fields: [
          { key: "address", group: "O01", consumer: "public_profile", writable: true },
          ...(r.scope === "center"
            ? [
                {
                  key: "work_calendar",
                  group: "O01",
                  consumer: "center_work_calendar_contains",
                  writable: state.writable,
                },
              ]
            : []),
        ],
        defaults: { address: "", work_calendar: null },
        brand_packages: [],
        limitations: [],
      });
    if (op === "settings_get_v1" && r.scope !== "user") {
      if (r.scope === "center" && state.failedReads > 0) {
        state.failedReads--;
        return fail("SERVICE_UNAVAILABLE", 503);
      }
      return send({
        scope: r.scope,
        version: state.version,
        values: { address: "Sentetik merkez", work_calendar: structuredClone(state.calendar) },
        overridden_fields: [],
        as_of: "2026-11-18T08:00:00Z",
        ...(r.scope === "organization" ? { logo: null } : {}),
      });
    }
    if (op === "management_state_get_v1" && r.operation === "settings_update_v1") {
      expect(r.selector.key.scope).toBe("center");
      return send({
        items: [
          {
            operation: "settings_update_v1",
            exists: true,
            entity: { type: "centers", id: I.center },
            state: "active",
            versions: [],
            current: {
              operation: "settings_update_v1",
              values: {
                scope: "center",
                settings_version: state.version,
                work_calendar: structuredClone(r.selector.key.work_calendar),
                work_calendar_impact: { count: state.impact, truncated: false, sessions: [] },
              },
            },
            as_of: "2026-11-18T08:00:00Z",
          },
        ],
        next_cursor: null,
      });
    }
    if (op === "settings_update_v1" && Object.hasOwn(r.patch, "work_calendar")) {
      state.writes.push(r);
      if (receipts.has(r.operation_key))
        return send({ ...receipts.get(r.operation_key), replayed: true });
      if (r.expected_version !== state.version) return fail("VERSION_CONFLICT");
      if (state.impact) return fail("OPEN_OPERATIONS_EXIST");
      state.calendar = structuredClone(r.patch.work_calendar);
      state.version++;
      state.effects++;
      const mutation = {
        operation_id: I.role,
        primary_id: I.account,
        version: state.version,
        replayed: false,
        related: [],
      };
      receipts.set(r.operation_key, mutation);
      if (state.afterAckFail) {
        state.afterAckFail = false;
        state.failedReads = 1;
      }
      if (state.lost) {
        state.lost = false;
        return route.abort();
      }
      return send(mutation);
    }
    if (op === "operation_status_get_v1" && r.operation === "settings_update_v1")
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: "accounts", id: I.account },
        version: state.version,
      });
    if (op === "program_preview_v1") {
      state.previews++;
      expect(state.calendar?.rules[0]?.local_end).toBe("12:00:00");
      expect(r.schedule.local_start).toBe(state.previews === 1 ? "12:30:00" : "11:30:00");
      if (state.previews === 1) expect(r.schedule).not.toHaveProperty("duration_minutes");
      else expect(r.schedule.duration_minutes).toBe(30);
      return send({
        id: I.role,
        token: "synthetic-program-preview",
        scope_hash: "synthetic-scope",
        expires_at: "2099-01-01T00:00:00Z",
        dependencies: { versions: [] },
        effects: [],
        blockers:
          state.previews === 1
            ? [{ code: "RESOURCE_CONFLICT", retryable: false, trace_id: I.role }]
            : [],
        sessions: [
          {
            session_id: I.lesson,
            interval: {
              starts_at: state.previews === 1 ? "2026-11-23T09:30:00Z" : "2026-11-23T08:30:00Z",
              ends_at: state.previews === 1 ? "2026-11-23T10:00:00Z" : "2026-11-23T09:00:00Z",
            },
          },
        ],
      });
    }
    if (op === "calendar_get_v1")
      return send({ items: [], next_cursor: null, as_of: "2026-11-18T08:00:00Z" });
    return route.fallback();
  });
  await openStudio(page);
  await page
    .getByRole("navigation", { name: "Ana menü", exact: true })
    .getByRole("link", { name: "Ayarlar", exact: true })
    .click();
  await page.getByRole("tab", { name: "Salonlar", exact: true }).click();
  await page.getByRole("button", { name: "Merkez çalışma saatleri", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Merkez çalışma saatleri", exact: true });
  await expect(
    sheet.getByRole("checkbox", { name: "Merkez iş takvimi kullan", exact: true }),
  ).toBeEnabled();
  return { state, studio, sheet };
}
async function draft(page: import("@playwright/test").Page) {
  const sheet = page.getByRole("dialog", { name: "Merkez çalışma saatleri", exact: true });
  await sheet
    .getByRole("checkbox", { name: "Merkez iş takvimi kullan", exact: true })
    .press("Space");
  await sheet.getByRole("button", { name: "Çalışma aralığı ekle", exact: true }).click();
  await sheet.getByRole("checkbox", { name: "Pazartesi", exact: true }).press("Space");
  await sheet.getByLabel("Başlangıç saati", { exact: true }).fill("09:00:00");
  await sheet.getByLabel("Bitiş saati", { exact: true }).fill("12:00:00");
  await sheet.getByLabel("Geçerlilik başlangıcı", { exact: true }).fill("2026-11-23");
  return sheet;
}
async function review(page: import("@playwright/test").Page) {
  await page
    .getByRole("dialog", { name: "Merkez çalışma saatleri", exact: true })
    .getByRole("button", { name: "Çalışma takvimini incele", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Çalışma takvimini incele", exact: true });
  await expect(dialog.getByText(/Pazartesi: 09:00:00–12:00:00/)).toBeVisible();
  await dialog.getByRole("checkbox").press("Space");
  return dialog;
}
test("work calendar saves only after native impact and explicit review; local dates survive reload", async ({
  page,
}) => {
  const f = await fixture(page);
  await draft(page);
  const dialog = await review(page);
  expect(f.state.writes).toHaveLength(0);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  expect((await scanAccessibility(page, "work-calendar-review-mobile-dark")).violations).toEqual(
    [],
  );
  await dialog
    .getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("güncel kayıt okundu");
  expect(f.state.calendar?.rules[0]).toMatchObject({
    weekdays: [1],
    local_start: "09:00:00",
    local_end: "12:00:00",
    valid_from: "2026-11-23",
  });
  expect(f.state.writes[0]).toMatchObject({
    scope: "center",
    org_id: I.org,
    center_id: I.center,
    expected_version: 1,
  });
  expect(f.studio.writes).toHaveLength(0);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await f.sheet.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.reload();
  await page.getByRole("tab", { name: "Salonlar", exact: true }).click();
  await page.getByRole("button", { name: "Merkez çalışma saatleri", exact: true }).click();
  await expect(f.sheet.getByLabel("Başlangıç saati", { exact: true })).toHaveValue("09:00:00");
  await f.sheet.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("navigation", { name: "Ana menü", exact: true })
    .getByRole("link", { name: "Ders programı", exact: true })
    .click();
  await page.getByRole("button", { name: "Seans ekle", exact: true }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("radio", { name: "Haftalık seri", exact: true }).click();
  await panel.locator("#schedule-create-class").selectOption(I.lesson);
  await panel.locator("#schedule-create-instructor").selectOption(I.instructor);
  await panel.locator("#schedule-create-room").selectOption(I.room);
  await panel.locator("#schedule-create-capacity").fill("2");
  await panel.locator("#schedule-create-date").fill("2026-11-23");
  await panel.locator("#schedule-create-time").fill("12:30");
  await expect(panel.locator("#schedule-create-duration")).toHaveValue("");
  await expect(panel.locator("#schedule-create-duration")).toHaveAccessibleDescription(
    "Dakika. Boş bırakırsanız merkezin program süresi kullanılır.",
  );
  await panel.locator("#schedule-create-weeks").fill("1");
  await panel.getByRole("button", { name: "Pzt", exact: true }).click();
  await panel.getByRole("button", { name: "Seansları önizle", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("uygunluk kurallarını");
  await expect(panel.getByRole("button", { name: "Seriyi oluştur", exact: true })).toHaveCount(0);
  await panel.locator("#schedule-create-time").fill("11:30");
  await panel.locator("#schedule-create-duration").fill("30");
  await panel.getByRole("button", { name: "Seansları önizle", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Seriyi oluştur", exact: true })).toBeEnabled();
  expect(f.state.previews).toBe(2);
  expect(f.studio.writes).toHaveLength(0);
});
test("work calendar blocks open-session effects and invalid ranges without a writer", async ({
  page,
}) => {
  const f = await fixture(page),
    sheet = await draft(page);
  f.state.impact = 1;
  await sheet.getByRole("button", { name: "Çalışma takvimini incele", exact: true }).click();
  await expect(sheet.getByText(/Değişiklik açık seansları etkiliyor/)).toBeFocused();
  expect(f.state.writes).toHaveLength(0);
  await sheet.getByLabel("Bitiş saati", { exact: true }).fill("08:00:00");
  await sheet.getByRole("button", { name: "Çalışma takvimini incele", exact: true }).click();
  await expect(sheet.getByText(/Gün, saat ve tarih aralıklarını kontrol et/)).toBeFocused();
  expect(f.state.writes).toHaveLength(0);
  await sheet.getByRole("button", { name: "Vazgeç", exact: true }).click();
});
for (const lost of [true, false])
  test(`work calendar recovery retains one operation when ${lost ? "reply is lost" : "confirmed result read fails"}`, async ({
    page,
  }) => {
    const f = await fixture(page);
    await draft(page);
    const dialog = await review(page);
    f.state.lost = lost;
    f.state.afterAckFail = !lost;
    await dialog
      .getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true })
      .click();
    const retry = dialog.getByRole("button", {
      name: lost ? "Aynı isteği yeniden dene" : "İşlem sonucunu kontrol et",
      exact: true,
    });
    await expect(retry).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
    await retry.click();
    await expect(dialog.getByRole("status")).toContainText("güncel kayıt okundu");
    expect(f.state.effects).toBe(1);
    expect(f.state.writes).toHaveLength(lost ? 2 : 1);
    if (lost) expect(f.state.writes[0]?.operation_key).toBe(f.state.writes[1]?.operation_key);
    await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
    await f.sheet.getByRole("button", { name: "Vazgeç", exact: true }).click();
  });
