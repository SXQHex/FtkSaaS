import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockSessionDetail, sessionIds as S } from "./session-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
async function setup(page: Page, mode: "normal" | "denied" | "empty" | "past-planned" = "normal") {
  const state = await mockSessionDetail(page, { existing: true, allowEditor: true });
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  state.session.starts_at =
    mode === "past-planned" ? "2026-11-16T10:00:00Z" : "2026-11-16T13:00:00Z";
  state.session.ends_at = mode === "past-planned" ? "2026-11-16T11:00:00Z" : "2026-11-16T14:00:00Z";
  state.calendarReads.length = 0;
  state.reads.length = 0;
  let denied = mode === "denied";
  const requests: Record<string, unknown>[] = [];
  await page.route("**/functions/v1/backend-v1/calendar_get_v1", async (route) => {
    const r = route.request().postDataJSON();
    requests.push(r);
    if (denied)
      return route.fulfill({
        status: 403,
        json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
      });
    if (mode === "empty")
      return route.fulfill({
        json: {
          ok: true,
          data: { items: [], next_cursor: null, as_of: "2026-11-16T12:00:00Z" },
          trace_id: I.role,
        },
      });
    return route.fallback();
  });
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/overview`);
  await expect(page.getByRole("heading", { name: "Bugünün programı", exact: true })).toBeVisible();
  return {
    ...state,
    requests,
    setDenied: (value: boolean) => {
      denied = value;
    },
  };
}
test("daily overview reads the center day and safe native member/package preview without finance scans", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await setup(page);
  const next = page.getByRole("region", { name: "Sıradaki ders", exact: true });
  await expect(next).toContainText("Sentetik seans");
  await expect(next).toContainText("Atanmış salon");
  await expect(next).toContainText("Örnek öğrenci");
  await expect(next).toContainText("Satın alınmış paket · 7 hak kaldı");
  expect(state.requests[0]).toMatchObject({
    org_id: I.org,
    center_id: I.center,
    interval: { starts_at: "2026-11-15T21:00:00Z", ends_at: "2026-11-16T21:00:00Z" },
  });
  expect(state.reads).not.toContain("finance_get_v1");
  expect(state.writes).toHaveLength(0);
  await expect(page.getByRole("heading", { name: "Bekleyen işler", exact: true })).toBeVisible();
  await expect(
    page.getByText("Bekleyen yönetim işleri şu anda okunamıyor.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bu kapsamda bekleyen yönetim işi yok.", { exact: true }),
  ).toHaveCount(0);
});
test("overview attendance action opens the existing native attendance tab without a writer", async ({
  page,
}) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Yoklamayı aç", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${S.session}\\?tab=attendance$`));
  await expect(page.getByRole("tab", { name: "Yoklama", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel", { name: "Yoklama", exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("overview add action opens the existing real single-session editor", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Ders ekle", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/schedule\\?create=true$`));
  await expect(page.getByRole("dialog", { name: "Tek seans ekle", exact: true })).toBeVisible();
  await expect(page.locator("#schedule-create-class")).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Vazgeç", exact: true }).click();
});
test("overview program and participant actions retain real scoped targets", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Tümünü gör", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${S.session}\\?tab=participants$`));
  await expect(page.getByRole("tab", { name: "Katılımcılar", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/overview`);
  await page.getByRole("button", { name: "Programı aç", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/o/${I.org}/c/${I.center}/schedule`);
  expect(state.writes).toHaveLength(0);
});
test("overview denied day remains unread and recovers through explicit source reading", async ({
  page,
}) => {
  const state = await setup(page, "denied");
  await expect(
    page.getByText("Bugünün programı okunamadı.", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Bugün görünür ders yok.", { exact: true })).toHaveCount(0);
  state.setDenied(false);
  await page.getByRole("button", { name: "Yeniden oku", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sentetik seans", exact: true })).toBeVisible();
});
test("overview actual empty day is distinct from unread and never fabricates a next lesson", async ({
  page,
}) => {
  await setup(page, "empty");
  await expect(page.getByText("Bugün görünür ders yok.", { exact: true })).toBeVisible();
  await expect(page.getByText("Sıradaki ders yok.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yoklamayı aç", exact: true })).toHaveCount(0);
});
test("overview keeps the provider planned state after the clock has passed", async ({ page }) => {
  await setup(page, "past-planned");
  await expect(page.getByText("Planlandı", { exact: true })).toBeVisible();
  await expect(page.getByText("Tamamlandı", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sentetik seans", exact: true }).click();
  await expect(page.getByRole("region", { name: "Seçili ders", exact: true })).toContainText(
    "Sentetik seans",
  );
});
