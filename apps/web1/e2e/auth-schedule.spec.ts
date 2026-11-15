import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type { SessionView } from "../src/lib/api-contracts/generated.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";

async function scheduleFixture(page: Page, withSession = false, verifiedInstructor = false) {
  const fixture = await mockStudio(page);
  if (verifiedInstructor) fixture.roles[0]!.accountAccessGranted = true;
  let session: SessionView | undefined;
  const writes: string[] = [];
  const reads: string[] = [];
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const request = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (operation === "calendar_get_v1") {
      reads.push(operation);
      if (withSession && !session) {
        const start = Date.parse(request.interval.starts_at) + 9 * 60 * 60 * 1000;
        session = {
          id: "019a7b00-0000-7000-8000-000000000085",
          class_id: I.lesson,
          discipline_id: I.discipline,
          format: "group",
          state: "planned",
          attendance_state: "open",
          starts_at: new Date(start).toISOString(),
          ends_at: new Date(start + 3600000).toISOString(),
          assignments: [{ person_id: I.instructor, duty: "instructor" }],
          version: 3,
          capacity: {
            total: 12,
            held: 2,
            remaining: 10,
            category_held: null,
            category_remaining: null,
            room_capacity: 20,
          },
        };
      }
      return send({
        items: session
          ? [
              {
                id: session.id,
                type: "session",
                center_id: I.center,
                starts_at: session.starts_at,
                ends_at: session.ends_at,
                title: "Sentetik program seansı",
                resources: [{ kind: "room", id: I.room }],
              },
            ]
          : [],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (operation === "session_get_v1") {
      reads.push(operation);
      return send(session);
    }
    if (
      operation === "management_state_get_v1" &&
      request.operation === "session_change_preview_v1"
    ) {
      reads.push("editor-policy-rejection");
      return route.fulfill({
        json: {
          ok: false,
          error: { code: "POLICY_NOT_CONFIGURED", retryable: false, trace_id: I.role },
        },
      });
    }
    if (
      [
        "session_create_v1",
        "program_apply_v1",
        "session_change_apply_v1",
        "session_cancel_apply_v1",
        "replacement_session_create_v1",
      ].includes(operation)
    ) {
      writes.push(operation);
      return route.abort();
    }
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/schedule`);
  await expect(page.getByRole("button", { name: "Seans ekle", exact: true })).toBeEnabled();
  await expect.poll(() => reads.includes("calendar_get_v1")).toBe(true);
  return {
    writes,
    reads,
    fixture,
    get session() {
      return session;
    },
  };
}

test("empty mobile week keeps all days and hours reachable with the native keyboard scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const state = await scheduleFixture(page);
  const scroll = page.getByRole("region", { name: "Program günleri", exact: true });
  await expect(scroll).toBeVisible();
  await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(300);
  // Enter from the adjacent ready toolbar. Focusing it can naturally reveal the header.
  await page.getByRole("radio", { name: "Hafta", exact: true }).click();
  await page.keyboard.press("Tab");
  await expect(scroll).toBeFocused();
  const before = await scroll.evaluate((el) => ({
    left: el.scrollLeft,
    top: el.scrollTop,
    outline: el.ownerDocument.defaultView!.getComputedStyle(el).outlineStyle,
  }));
  expect(before.outline).not.toBe("none");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before.left);
  await page.keyboard.press("PageDown");
  await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(before.top);
  expect((await scanAccessibility(page, "empty-mobile-week")).violations).toEqual([]);
  await page.getByRole("radio", { name: "Gün", exact: true }).click();
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollWidth - el.clientWidth))
    .toBeLessThanOrEqual(1);
  expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
  expect(state.writes).toEqual([]);
});

test("missing editor policy keeps session details and independent cancellation accessible", async ({
  page,
}) => {
  const state = await scheduleFixture(page, true);
  await page.getByText("Sentetik program seansı", { exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(
    panel.getByRole("heading", { name: "Sentetik program seansı", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText(
      "Seans ayrıntıları okunabiliyor; düzenleme için gereken güncel kaynak şu anda alınamıyor.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: "Seansı düzenle", exact: true })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Seansı iptal et", exact: true })).toBeEnabled();
  await expect(panel.getByText(state.fixture.rooms[0]!.name, { exact: true })).toBeVisible();
  await expect(panel.getByText("Tango", { exact: true })).toBeVisible();
  expect(state.reads).toContain("editor-policy-rejection");
  expect(state.writes).toEqual([]);
  expect((await scanAccessibility(page, "read-only-session-policy-rejection")).violations).toEqual(
    [],
  );
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("blocked program preview explains the native reason and clears it when the draft changes", async ({
  page,
}) => {
  const state = await scheduleFixture(page, false, true);
  let previews = 0;
  await page.route("**/functions/v1/backend-v1/program_preview_v1", async (route) => {
    const request = route.request().postDataJSON();
    expect(request.class_id).toBe(I.lesson);
    expect(request.schedule.room_id).toBe(I.room);
    previews++;
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          id: "019a7b00-0000-7000-8000-000000000093",
          token: "synthetic-preview-token",
          scope_hash: "synthetic-preview-scope",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          dependencies: { versions: [] },
          effects: [],
          blockers: [{ code: "RESOURCE_CONFLICT", retryable: false, trace_id: I.role }],
          sessions: [
            {
              session_id: "019a7b00-0000-7000-8000-000000000094",
              interval: {
                starts_at: "2026-11-17T08:17:00Z",
                ends_at: "2026-11-17T08:47:00Z",
              },
            },
          ],
        },
      },
    });
  });
  await page.getByRole("button", { name: "Seans ekle", exact: true }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("radio", { name: "Haftalık seri", exact: true }).click();
  await panel.locator("#schedule-create-class").selectOption(I.lesson);
  await panel.locator("#schedule-create-instructor").selectOption(I.instructor);
  await panel.locator("#schedule-create-room").selectOption(I.room);
  await panel.locator("#schedule-create-capacity").fill("2");
  await panel.locator("#schedule-create-date").fill("2026-11-17");
  await panel.locator("#schedule-create-time").fill("11:17");
  await panel.locator("#schedule-create-duration").fill("30");
  await panel.locator("#schedule-create-weeks").fill("1");
  await panel.getByRole("button", { name: "Sal", exact: true }).click();
  await panel.getByRole("button", { name: "Seansları önizle", exact: true }).click();
  await expect(panel.getByRole("alert")).toHaveText(
    "Seçilen saat, salon veya eğitmen uygunluk kurallarını karşılamıyor ya da başka bir kayıtla çakışıyor.",
  );
  await expect(panel.getByRole("button", { name: "Seriyi oluştur", exact: true })).toHaveCount(0);
  expect(previews).toBe(1);
  expect(state.writes).toEqual([]);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
  expect((await scanAccessibility(page, "blocked-program-preview")).violations).toEqual([]);
  await panel.locator("#schedule-create-time").fill("12:17");
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel.getByRole("region", { name: "Oluşacak seanslar", exact: true })).toHaveCount(
    0,
  );
  expect(state.writes).toEqual([]);
});

test("a blocked cancellation explains its reason inside the active session sheet", async ({
  page,
}) => {
  const state = await scheduleFixture(page, true);
  await page.route("**/functions/v1/backend-v1/session_cancel_preview_v1", async (route) => {
    const request = route.request().postDataJSON();
    expect(request.reason).toBe("Sentetik iptal gerekçesi");
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          id: "019a7b00-0000-7000-8000-000000000095",
          token: "synthetic-cancel-preview",
          scope_hash: "synthetic-cancel-scope",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          dependencies: {
            versions: [{ entity: { type: "sessions", id: request.session_id }, version: 3 }],
          },
          effects: [{ entity: { type: "sessions", id: request.session_id }, action: "cancel" }],
          blockers: [{ code: "RESERVATION_EXISTS", retryable: false, trace_id: I.role }],
        },
      },
    });
  });
  await page.getByText("Sentetik program seansı", { exact: true }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Seansı iptal et", exact: true }).click();
  await panel.locator("#schedule-session-reason").fill("Sentetik iptal gerekçesi");
  await panel.getByRole("button", { name: "Etkiyi önizle", exact: true }).click();
  await expect(panel.getByRole("alert")).toHaveText(
    "Mevcut rezervasyonlar bu değişikliği engelliyor. Güncel etkiyi incele.",
  );
  await expect(panel.getByRole("button", { name: "Onayla ve uygula", exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test("a newer detail version does not borrow resources from a stale calendar row", async ({
  page,
}) => {
  const state = await scheduleFixture(page, true);
  expect(state.session).toBeDefined();
  state.session!.version = 4;
  await page.getByText("Sentetik program seansı", { exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(
    panel.getByRole("heading", { name: "Sentetik program seansı", exact: true }),
  ).toBeVisible();
  await expect(panel.getByText(state.fixture.rooms[0]!.name, { exact: true })).toHaveCount(0);
  await expect(panel.getByText("Tango", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Seansı düzenle", exact: true })).toBeDisabled();
  expect(state.writes).toEqual([]);
});
