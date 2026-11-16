import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { Temporal } from "temporal-polyfill";
import { mockSessionDetail, sessionIds as S } from "./session-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const saved = "İşlem kaydedildi; güncel yoklama ve seans okundu.";
async function begin(page: Page) {
  const target = Temporal.Instant.fromEpochMilliseconds(Date.now() - 5 * 60000).toZonedDateTimeISO(
    "Europe/Istanbul",
  );
  const time = target.toPlainTime().toString({ smallestUnit: "minute" });
  await page
    .getByLabel("Fiilî başlangıç günü", { exact: true })
    .fill(target.toPlainDate().toString());
  await page.getByLabel("Fiilî başlangıç saati", { exact: true }).fill(time);
  await page.getByRole("button", { name: "Yoklamayı başlat", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(time);
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Seans şimdi başladı");
  await dialog
    .getByRole("checkbox", { name: "Seçtiğim fiilî başlangıç zamanını onaylıyorum.", exact: true })
    .press("Space");
  await dialog.getByRole("button", { name: "Yoklamayı başlat", exact: true }).click();
  return { dialog, time };
}
test("instructor today and weekly navigation retain center scope and open only the assigned session", async ({
  page,
}) => {
  const state = await mockSessionDetail(page, { existing: true, instructor: true });
  await page.getByRole("button", { name: "Bugünkü derslerime dön", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/instructor/today?org=${I.org}&center=${I.center}`);
  const weekButton = page.getByRole("button", { name: "Haftalık programım", exact: true });
  await expect(weekButton).toBeEnabled();
  const beforeWeekReads = state.calendarReads.length;
  await weekButton.click();
  await expect(page).toHaveURL(`${origin}/instructor/schedule?org=${I.org}&center=${I.center}`);
  await expect(page).toHaveTitle("Programım · Fethiye Tango");
  await expect(page.getByText("Sentetik seans", { exact: true })).toBeVisible();
  expect(state.calendarReads.length - beforeWeekReads).toBe(1);
  await page.getByRole("button", { name: "Sonraki hafta", exact: true }).click();
  await expect(page.getByText("Sentetik seans", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Önceki hafta", exact: true }).click();
  await page.getByText("Sentetik seans", { exact: true }).click();
  await expect(page).toHaveURL(
    `${origin}/instructor/sessions/${S.session}?org=${I.org}&center=${I.center}`,
  );
  expect(state.writes).toHaveLength(0);
  expect(state.reads).not.toContain("entitlements_get_v1");
  await expect(page.getByRole("button", { name: "Üye ekle", exact: true })).toHaveCount(0);
});
test("instructor selects actual start, explicitly marks, closes and corrects without member finance reads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await mockSessionDetail(page, { existing: true, instructor: true });
  const { dialog, time } = await begin(page);
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  const request = state.writes.find((row) => row.operation === "attendance_start_v1")!.request;
  expect(
    Temporal.Instant.from(request.actual_started_at as string)
      .toZonedDateTimeISO("Europe/Istanbul")
      .toPlainTime()
      .toString({ smallestUnit: "minute" }),
  ).toBe(time);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Yoklama — Örnek öğrenci", exact: true })
    .selectOption("attended");
  await page.getByRole("button", { name: "Kaydet — Örnek öğrenci", exact: true }).click();
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yoklamayı kapat", exact: true }).click();
  const close = page.getByRole("alertdialog");
  await close.getByRole("checkbox", { name: "Seans gerçekleşti", exact: true }).press("Space");
  await close.getByRole("checkbox", { name: "Örnek Eğitmen", exact: true }).press("Space");
  await close
    .getByRole("checkbox", {
      name: "Yoklama sonuçlarını ve gerçekleşen eğitmenleri kontrol ettim.",
      exact: true,
    })
    .press("Space");
  await close.getByRole("button", { name: "Yoklamayı kapat", exact: true }).click();
  await expect(close.getByText(saved, { exact: true })).toBeVisible();
  await close.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("button", { name: "Yoklamayı düzenle", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Yoklama — Örnek öğrenci", exact: true })
    .selectOption("no_show");
  await page.getByLabel("Düzeltme gerekçesi", { exact: true }).fill("Sentetik yoklama düzeltmesi");
  await page.getByRole("button", { name: "Düzeltmeyi incele", exact: true }).click();
  const review = page.getByRole("dialog");
  await expect(review.getByText(/9\.999,99/)).toHaveCount(0);
  await expect(review.getByText("Sentetik gizli mali açıklama", { exact: true })).toHaveCount(0);
  await review.getByRole("checkbox").press("Space");
  await review.getByRole("button", { name: "Düzeltmeyi kaydet", exact: true }).click();
  await expect(review.getByText(saved, { exact: true })).toBeVisible();
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect(state.attendance.entries[0]!.result).toBe("no_show");
  expect(
    state.reads.filter((op) =>
      ["entitlements_get_v1", "finance_get_v1", "people_list_v1"].includes(op),
    ),
  ).toEqual([]);
  expect(state.writes.map((row) => row.operation)).toEqual([
    "attendance_start_v1",
    "attendance_mark_v1",
    "attendance_close_v1",
    "attendance_correct_apply_v1",
  ]);
});
test("instructor unknown attendance outcome retains one write and recovers its receipt", async ({
  page,
}) => {
  const state = await mockSessionDetail(page, {
    existing: true,
    instructor: true,
    attendanceUnknown: true,
  });
  const { dialog } = await begin(page);
  await expect(
    dialog.getByText("Sonuç bilinmiyor. Aynı isteği yeniden dene veya işlem durumunu oku.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "İşlem sonucunu oku", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.reads).not.toContain("entitlements_get_v1");
});
test("instructor acknowledged attendance retries only result reads", async ({ page }) => {
  const state = await mockSessionDetail(page, {
    existing: true,
    instructor: true,
    attendanceAckUnread: true,
  });
  const { dialog } = await begin(page);
  await expect(
    dialog.getByText(
      "İşlem alındı; güncel yoklama ve seans henüz okunamadı. Yeniden yazmadan sonucu oku.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "İşlem sonucunu oku", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("instructor direct unassigned session stops before attendance and person readers", async ({
  page,
}) => {
  const state = await mockSessionDetail(page, { existing: true, instructor: true });
  state.session.assignments = [{ person_id: I.self, duty: "instructor" }];
  state.reads.length = 0;
  await page.reload();
  await expect(
    page.getByText("Atanmış seans veya güncel yoklama okunamadı.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sentetik seans", exact: true })).toHaveCount(0);
  expect(
    state.reads.filter((op) =>
      ["calendar_get_v1", "attendance_get_v1", "person_get_v1"].includes(op),
    ),
  ).toEqual([]);
});
test("native instructor write denial preserves readable session and does not manufacture saved state", async ({
  page,
}) => {
  const state = await mockSessionDetail(page, {
    existing: true,
    instructor: true,
    writeDenied: true,
  });
  const { dialog } = await begin(page);
  await expect(
    dialog.getByText("İşlem reddedildi. Güncel kaynağı okuyup yeniden incele.", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(saved, { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sentetik seans", exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});

test("instructor repeated actual time requires a retained explicit UTC offset", async ({
  page,
}) => {
  const state = await mockSessionDetail(page, { existing: true, instructor: true });
  await page.route("**/functions/v1/backend-v1/centers_list_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          items: [
            {
              id: I.center,
              name: "Fixture Center",
              timezone: "America/New_York",
              state: "active",
              accessible: true,
              version: 1,
            },
          ],
          next_cursor: null,
          as_of: new Date().toISOString(),
        },
        trace_id: I.role,
      },
    }),
  );
  await page.reload();
  await page.getByLabel("Fiilî başlangıç günü", { exact: true }).fill("2026-11-01");
  await page.getByLabel("Fiilî başlangıç saati", { exact: true }).fill("01:30");
  await expect(page.getByRole("button", { name: "Yoklamayı başlat", exact: true })).toBeDisabled();
  const offset = page.getByLabel("UTC farkı", { exact: true });
  await offset.selectOption("-05:00");
  await expect(offset).toBeVisible();
  await expect(offset).toHaveValue("-05:00");
  await page.getByRole("button", { name: "Yoklamayı başlat", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("GMT-5");
  expect(state.writes).toHaveLength(0);
});

test("weekly instructor read denial stays unknown and recovers on explicit retry", async ({
  page,
}) => {
  const state = await mockSessionDetail(page, { existing: true, instructor: true });
  let denied = true;
  await page.route("**/functions/v1/backend-v1/calendar_get_v1", (route) =>
    denied
      ? route.fulfill({
          status: 403,
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        })
      : route.fallback(),
  );
  await page.goto(`${origin}/instructor/schedule?org=${I.org}&center=${I.center}`);
  await expect(page.getByText("Güncel atanmış seanslar okunamadı.", { exact: true })).toBeVisible();
  await expect(page.getByText("Bu hafta atanmış seansın yok.", { exact: true })).toHaveCount(0);
  denied = false;
  await page.getByRole("button", { name: "Yeniden oku", exact: true }).click();
  await expect(page.getByText("Sentetik seans", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
