import { activate, attemptOutsideDismissal } from "./device-input.js";
import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { Temporal } from "temporal-polyfill";
import { mockSessionDetail, sessionIds as S } from "./session-detail-fixture.js";
import { mockOwnReservations } from "./member-reservations-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const saved = "İşlem kaydedildi; güncel yoklama ve seans okundu.";
const calendarDay = new Date("2026-11-18T09:00:00Z");
async function begin(page: Page) {
  const target = Temporal.Instant.fromEpochMilliseconds(Date.now() - 5 * 60000).toZonedDateTimeISO(
    "Europe/Istanbul",
  );
  const time = target.toPlainTime().toString({ smallestUnit: "minute" });
  await page
    .getByLabel("Fiilî başlangıç günü", { exact: true })
    .fill(target.toPlainDate().toString());
  await page.getByLabel("Fiilî başlangıç saati", { exact: true }).fill(time);
  await activate(page.getByRole("button", { name: "Yoklamayı başlat", exact: true }));
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(time);
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Seans şimdi başladı");
  await activate(
    dialog.getByRole("checkbox", {
      name: "Seçtiğim fiilî başlangıç zamanını onaylıyorum.",
      exact: true,
    }),
    "Space",
  );
  await activate(dialog.getByRole("button", { name: "Yoklamayı başlat", exact: true }));
  return { dialog, time };
}
test("instructor today and weekly navigation retain center scope and open only the assigned session", async ({
  page,
}) => {
  await page.clock.setFixedTime(calendarDay);
  const state = await mockSessionDetail(page, {
    existing: true,
    instructor: true,
    now: calendarDay,
  });
  await expect(page.getByText("Atanmış salon", { exact: true })).toBeVisible();
  const actualTime = page.getByLabel("Fiilî başlangıç saati", { exact: true });
  await expect(actualTime).toHaveAttribute("aria-invalid", "false");
  await expect(actualTime).not.toHaveAttribute("aria-describedby", "actual-time-error");
  const beforeWeekReads = state.calendarReads.length;
  await activate(page.getByRole("button", { name: "Bugünkü derslerime dön", exact: true }));
  await expect(page).toHaveURL(`${origin}/instructor/today?org=${I.org}&center=${I.center}`);
  await expect(page.getByText(/Atanmış salon/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Sentetik seans/ })).toBeVisible();
  expect(state.calendarReads.length).toBe(beforeWeekReads + 1);
  const currentWeek = state.calendarReads.at(-1)?.interval;
  const weekButton = page.getByRole("button", { name: "Haftalık programım", exact: true });
  await expect(weekButton).toBeEnabled();
  await activate(weekButton);
  await expect(page).toHaveURL(`${origin}/instructor/schedule?org=${I.org}&center=${I.center}`);
  await expect(page).toHaveTitle("Programım · Fethiye Tango");
  await expect(page.getByText("Sentetik seans · Atanmış salon", { exact: true })).toBeVisible();
  expect(state.calendarReads.length - beforeWeekReads).toBe(1);
  await activate(page.getByRole("button", { name: "Sonraki hafta", exact: true }));
  await expect.poll(() => state.calendarReads.length).toBe(beforeWeekReads + 2);
  expect(state.calendarReads.at(-1)?.interval).not.toEqual(currentWeek);
  await expect(page.getByText("Sentetik seans · Atanmış salon", { exact: true })).toHaveCount(0);
  await activate(page.getByRole("button", { name: "Önceki hafta", exact: true }));
  await expect(page.getByText("Sentetik seans · Atanmış salon", { exact: true })).toBeVisible();
  expect(state.calendarReads.length).toBe(beforeWeekReads + 2);
  await activate(page.getByText("Sentetik seans · Atanmış salon", { exact: true }));
  await expect(page).toHaveURL(
    `${origin}/instructor/sessions/${S.session}?org=${I.org}&center=${I.center}`,
  );
  expect(state.calendarReads.every((req) => req.include_room_labels === true)).toBe(true);
  await expect(page.getByText("Atanmış salon", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  expect(state.reads).not.toContain("entitlements_get_v1");
  await expect(page.getByRole("button", { name: "Üye ekle", exact: true })).toHaveCount(0);
});
test("Starter instructor opens an assigned lesson from the daily panel after role plan denial", async ({
  page,
}) => {
  await page.clock.setFixedTime(calendarDay);
  const state = await mockSessionDetail(page, {
    existing: true,
    instructor: true,
    starterRoleGate: true,
    now: calendarDay,
  });
  await activate(page.getByRole("button", { name: "Bugünkü derslerime dön", exact: true }));
  await expect(page).toHaveURL(`${origin}/instructor/today?org=${I.org}&center=${I.center}`);
  await activate(page.getByRole("button", { name: /Sentetik seans/ }));
  await expect(page).toHaveURL(
    `${origin}/instructor/sessions/${S.session}?org=${I.org}&center=${I.center}`,
  );
  await expect(page.getByText("Atanmış salon", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Stüdyo", exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test("a closed lesson allows only its center manager to correct the native attendance", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 950 });
  const now = Date.now();
  const state = await mockSessionDetail(page, {
    existing: true,
    instructor: true,
    attendanceWindow: {
      policy_id: S.preview,
      opens_at: new Date(now - 40 * 60000).toISOString(),
      closes_at: new Date(now + 55 * 60000).toISOString(),
    },
  });
  await expect(page.getByText(/Yoklama başlangıç ve işaretleme aralığı/)).toBeVisible();
  const { dialog, time } = await begin(page);
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  const request = state.writes.find((row) => row.operation === "attendance_start_v1")!.request;
  expect(
    Temporal.Instant.from(request.actual_started_at as string)
      .toZonedDateTimeISO("Europe/Istanbul")
      .toPlainTime()
      .toString({ smallestUnit: "minute" }),
  ).toBe(time);
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
  const draft = page.getByRole("combobox", { name: "Yoklama — Örnek öğrenci", exact: true });
  const closeRevision = state.attendance.revision;
  const closeButton = page.getByRole("button", { name: "Yoklamayı kapat", exact: true });
  await expect(closeButton).toBeDisabled();
  await expect(closeButton).toHaveAccessibleDescription(
    "Kapatmadan önce tüm yoklama sonuçlarını kaydet.",
  );
  await draft.selectOption("no_show");
  await expect(closeButton).toBeDisabled();
  await activate(page.getByRole("button", { name: "Kaydet — Örnek öğrenci", exact: true }));
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  expect(state.attendance.entries[0]!.result).toBe("no_show");
  expect(state.attendance.closure_state).toBe("open");
  expect(state.attendance.revision).toBe(closeRevision);
  await expect(closeButton).toBeEnabled();
  await page
    .getByRole("combobox", { name: "Yoklama — Örnek öğrenci", exact: true })
    .selectOption("attended");
  await activate(page.getByRole("button", { name: "Kaydet — Örnek öğrenci", exact: true }));
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  expect(state.attendance.entries[0]!.result).toBe("attended");
  expect(state.attendance.closure_state).toBe("open");
  expect(state.attendance.revision).toBe(closeRevision);
  await activate(page.getByRole("button", { name: "Yoklamayı kapat", exact: true }));
  const close = page.getByRole("alertdialog");
  await activate(close.getByRole("checkbox", { name: "Seans gerçekleşti", exact: true }), "Space");
  await activate(close.getByRole("checkbox", { name: "Örnek Eğitmen", exact: true }), "Space");
  await activate(
    close.getByRole("checkbox", {
      name: "Yoklama sonuçlarını ve gerçekleşen eğitmenleri kontrol ettim.",
      exact: true,
    }),
    "Space",
  );
  await activate(close.getByRole("button", { name: "Yoklamayı kapat", exact: true }));
  await expect(close.getByText(saved, { exact: true })).toBeVisible();
  await activate(close.getByRole("button", { name: "Vazgeç", exact: true }));
  const closedRevision = state.attendance.revision;
  const sessionVersion = state.session.version;
  await expect(page.getByRole("button", { name: "Yoklamayı düzenle", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Düzeltme talebi gönder" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Talebi kabul et" })).toHaveCount(0);
  expect(state.attendance.entries[0]!.result).toBe("attended");
  expect(
    state.reads.filter((op) =>
      ["entitlements_get_v1", "finance_get_v1", "people_list_v1"].includes(op),
    ),
  ).toEqual([]);
  expect(state.writes.map((row) => row.operation)).toEqual([
    "attendance_start_v1",
    "attendance_mark_v1",
    "attendance_mark_v1",
    "attendance_close_v1",
  ]);
  const source = {
    session: state.session,
    attendance: state.attendance,
    reservation: state.reservation!,
  };
  const browser = page.context().browser()!;
  const owner = await browser.newPage();
  try {
    const ownerState = await mockSessionDetail(owner, { existing: true, source });
    await activate(owner.getByRole("tab", { name: "Yoklama", exact: true }));
    await expect(owner.getByRole("combobox", { name: "Yoklama — Örnek öğrenci" })).toHaveValue(
      "attended",
    );
    await expect(owner.getByRole("button", { name: "Yoklamayı düzenle" })).toHaveCount(0);
    expect(ownerState.writes).toHaveLength(0);
  } finally {
    await owner.close();
  }
  const manager = await browser.newPage();
  try {
    const management = await mockSessionDetail(manager, {
      existing: true,
      source,
      centerManager: true,
    });
    await activate(manager.getByRole("tab", { name: "Yoklama", exact: true }));
    const panel = manager.getByRole("tabpanel", { name: "Yoklama", exact: true });
    await expect(panel.getByText(new RegExp(`Başlangıç: .*${time}`))).toBeVisible();
    await expect(
      panel.getByRole("combobox", { name: "Yoklama — Örnek öğrenci", exact: true }),
    ).toHaveValue("attended");
    await expect(
      panel.getByRole("button", { name: "Yoklamayı düzenle", exact: true }),
    ).toBeEnabled();
    await expect(panel.getByRole("button", { name: /Talebi (kabul et|reddet)/ })).toHaveCount(0);
    await activate(panel.getByRole("button", { name: "Yoklamayı düzenle", exact: true }));
    await panel.getByRole("combobox", { name: "Yoklama — Örnek öğrenci" }).selectOption("no_show");
    await panel
      .getByLabel("Düzeltme gerekçesi", { exact: true })
      .fill("Sentetik yoklama düzeltmesi");
    await activate(panel.getByRole("button", { name: "Düzeltmeyi incele", exact: true }));
    const review = manager.getByRole("dialog");
    await expect(review.getByText("Serbest bırakma", { exact: true })).toBeVisible();
    expect(management.writes).toHaveLength(0);
    await activate(review.getByRole("checkbox"), "Space");
    await activate(review.getByRole("button", { name: "Düzeltmeyi kaydet", exact: true }));
    await expect(review.getByText(saved, { exact: true })).toBeVisible();
    expect(management.writes).toEqual([
      {
        operation: "attendance_correct_apply_v1",
        request: expect.objectContaining({
          org_id: I.org,
          center_id: I.center,
          preview: { id: S.preview, token: "synthetic-attendance-preview" },
        }),
      },
    ]);
    expect(source.attendance.entries[0]!.result).toBe("no_show");
    expect(source.attendance.revision).toBe(closedRevision + 1);
    expect(source.session.version).toBeGreaterThan(sessionVersion);
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Yoklama — Örnek öğrenci" })).toHaveValue(
      "no_show",
    );
    await expect(page.getByRole("button", { name: "Düzeltme talebi gönder" })).toHaveCount(0);
  } finally {
    await manager.close();
  }
  const member = await browser.newPage();
  try {
    const own = await mockOwnReservations(member, { closedLesson: source });
    const history = member.getByRole("grid", { name: "Geçmiş", exact: true });
    const lesson = history.getByRole("row").filter({
      has: member.getByRole("gridcell", { name: "Sentetik seans", exact: true }),
    });
    await expect(
      lesson.getByRole("gridcell", { name: "Tamamlandı · Gelmedi", exact: true }),
    ).toBeVisible();
    await expect(
      member.getByRole("button", { name: /Yoklamayı (başlat|kapat|düzenle)/ }),
    ).toHaveCount(0);
    expect(own.reads).toContainEqual(
      expect.objectContaining({
        operation: "attendance_get_v1",
        request: expect.objectContaining({ session_id: S.session, center_id: I.center }),
      }),
    );
    await expect(member.getByText("Sentetik yoklama düzeltmesi")).toHaveCount(0);
    expect(own.writes).toHaveLength(0);
  } finally {
    await member.close();
  }
});
test("native attendance window opens and closes without reloading the session", async ({
  page,
}) => {
  const now = new Date();
  await page.clock.install({ time: now });
  const state = await mockSessionDetail(page, {
    existing: true,
    instructor: true,
    now,
    attendanceWindow: {
      policy_id: S.preview,
      opens_at: new Date(now.getTime() + 60_000).toISOString(),
      closes_at: new Date(now.getTime() + 120_000).toISOString(),
    },
  });
  const start = page.getByRole("button", { name: "Yoklamayı başlat", exact: true });
  await expect(start).toBeDisabled();
  await expect(page.getByText(/Şu anda yoklama başlatılamaz/)).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(start).toBeEnabled();
  await page.clock.fastForward(60_000);
  await expect(start).toBeDisabled();
  await expect(page.getByText(/Şu anda yoklama başlatılamaz/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
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
  await attemptOutsideDismissal(dialog);
  await expect(dialog).toBeVisible();
  await activate(dialog.getByRole("button", { name: "İşlem sonucunu oku", exact: true }));
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
  await activate(dialog.getByRole("button", { name: "İşlem sonucunu oku", exact: true }));
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
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
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
  await activate(page.getByRole("button", { name: "Yoklamayı başlat", exact: true }));
  await expect(page.getByRole("alertdialog")).toContainText("GMT-5");
  expect(state.writes).toHaveLength(0);
});

test("weekly instructor read denial stays unknown and recovers on explicit retry", async ({
  page,
}) => {
  await page.clock.setFixedTime(calendarDay);
  const state = await mockSessionDetail(page, {
    existing: true,
    instructor: true,
    now: calendarDay,
  });
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
  await activate(page.getByRole("button", { name: "Yeniden oku", exact: true }));
  await expect(page.getByText("Sentetik seans · Atanmış salon", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
