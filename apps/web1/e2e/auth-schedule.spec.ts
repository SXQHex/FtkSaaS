import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type { SessionView } from "../src/lib/api-contracts/generated.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";

async function scheduleFixture(page: Page, withSession = false) {
  await mockStudio(page);
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
  return { writes, reads };
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
    panel.getByText(/Düzenleme için gereken program yapılandırması eksik/),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: "Seansı düzenle", exact: true })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Seansı iptal et", exact: true })).toBeEnabled();
  expect(state.reads).toContain("editor-policy-rejection");
  expect(state.writes).toEqual([]);
  expect((await scanAccessibility(page, "read-only-session-policy-rejection")).violations).toEqual(
    [],
  );
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});
