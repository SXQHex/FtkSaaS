import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type { SessionView } from "../src/lib/api-contracts/generated.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const uid = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
async function fixture(
  page: Page,
  mode: "normal" | "earnings-denied" | "no-instructor" | "list-denied" = "normal",
) {
  await mockStudio(page);
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  let calendarDenied = mode === "list-denied";
  const reads: { operation: string; request: Record<string, unknown> }[] = [];
  const sessions: SessionView[] = [
    [uid(81), "2026-11-16T08:00:00Z", "2026-11-16T09:00:00Z"],
    [uid(82), "2026-11-16T15:00:00Z", "2026-11-16T16:00:00Z"],
    [uid(83), "2026-11-18T15:00:00Z", "2026-11-18T16:00:00Z"],
  ].map(([id, starts_at, ends_at], index) => ({
    id: id!,
    class_id: I.lesson,
    discipline_id: I.discipline,
    format: "group",
    starts_at: starts_at!,
    ends_at: ends_at!,
    state: index === 0 ? "occurred" : "planned",
    attendance_state: index === 0 ? "closed" : "open",
    version: 1,
    assignments: [{ person_id: I.self, duty: "instructor" }],
    capacity: {
      total: 12,
      held: 8,
      remaining: 4,
      category_held: null,
      category_remaining: null,
      room_capacity: 20,
    },
  }));
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const req = route.request().postDataJSON();
    reads.push({ operation, request: req });
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const denied = () =>
      route.fulfill({
        status: 403,
        json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
      });
    if (operation === "organizations_list_v1")
      return send({
        items: [
          {
            id: I.org,
            name: "Fixture Studio",
            state: "active",
            access_mode: "normal",
            version: 1,
            self_context: {
              person_id: I.self,
              subscriber_number: null,
              centers: [
                {
                  center_id: I.center,
                  instructor: mode !== "no-instructor",
                  student: false,
                  assistant: false,
                },
              ],
            },
          },
        ],
        next_cursor: null,
        as_of: "2026-11-16T12:00:00Z",
      });
    if (operation === "roles_list_v1")
      return mode === "no-instructor"
        ? send({
            items: [
              {
                id: I.role,
                person_id: I.self,
                role: "owner",
                scope_center_id: null,
                state: "active",
                version: 1,
              },
            ],
            next_cursor: null,
            as_of: "2026-11-16T12:00:00Z",
          })
        : denied();
    if (operation === "calendar_get_v1") {
      if (calendarDenied) return denied();
      expect(req.resource).toEqual({ kind: "person", id: I.self });
      expect(req.interval).toEqual({
        starts_at: "2026-11-15T21:00:00Z",
        ends_at: "2026-11-22T21:00:00Z",
      });
      const selected = req.page.cursor ? sessions.slice(2) : sessions.slice(0, 2);
      return send({
        items: selected.map((row, index) => ({
          id: row.id,
          type: "session",
          center_id: I.center,
          title: `Sentetik atanmış ${req.page.cursor ? 3 : index + 1}`,
          starts_at: row.starts_at,
          ends_at: row.ends_at,
          resources: [{ kind: "room", id: I.room }],
        })),
        next_cursor: req.page.cursor ? null : "second-session-page",
        as_of: "2026-11-16T12:00:00Z",
      });
    }
    if (operation === "session_get_v1") {
      expect(req.include_room_labels).toBe(true);
      return send({
        ...sessions.find((row) => row.id === req.session_id),
        room_labels: [{ room_id: I.room, name: "Atanmış salon" }],
      });
    }
    if (operation === "attendance_get_v1") {
      const session = sessions.find((row) => row.id === req.session_id)!;
      return send({
        session_id: session.id,
        session_version: 1,
        closure_state: session.attendance_state,
        revision: 0,
        entries: [],
        actual_started_at: session.attendance_state === "closed" ? session.starts_at : null,
      });
    }
    if (operation === "earnings_list_v1") {
      if (mode === "earnings-denied") return denied();
      expect(req.person_id).toBe(I.self);
      expect(req.center_id).toBe(I.center);
      expect(req.interval).toEqual({
        starts_at: "2026-10-31T21:00:00Z",
        ends_at: "2026-11-30T21:00:00Z",
      });
      const base = {
        person_id: I.self,
        center_id: I.center,
        session_id: sessions[0]!.id,
        event_assignment_id: null,
        paid_minor: "0",
        remaining_minor: "0",
        previous_id: null,
        closure_id: null,
        created_at: "2026-11-16T12:00:00Z",
        version: 1,
        basis: { source: "agreement_fixed", currency: "TRY", quantity: 1, excluded_blocked: 0 },
      };
      return send({
        items: req.page.cursor
          ? [
              { ...base, id: uid(92), amount_minor: "3", currency: "TRY", direction: "subtract" },
              { ...base, id: uid(93), amount_minor: "100", currency: "USD", direction: "add" },
            ]
          : [
              {
                ...base,
                id: uid(91),
                amount_minor: "9007199254740993",
                currency: "TRY",
                direction: "add",
              },
            ],
        next_cursor: req.page.cursor ? null : "earnings-second-page",
        as_of: "2026-11-16T12:00:00Z",
      });
    }
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.goto(`${origin}/instructor/today?org=${I.org}&center=${I.center}`);
  await expect(page.getByRole("heading", { name: "Bugün", exact: true })).toBeVisible();
  return {
    reads,
    permitCalendar: () => {
      calendarDenied = false;
    },
  };
}
test("instructor day reads all scoped week pages and exact monthly currencies without private member readers", async ({
  page,
}) => {
  const { reads } = await fixture(page);
  await expect(page.getByText(/Atanmış salon/).first()).toBeVisible();
  await expect(page.getByText("3 seans", { exact: true })).toBeVisible();
  await expect(page.getByText("2 seans", { exact: true })).toBeVisible();
  await expect(page.getByText("Sentetik atanmış 3", { exact: true })).toBeVisible();
  await expect(page.getByText(/90\.071\.992\.547\.409,90.*1,00/)).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Ana menü", exact: true })
      .getByRole("link", { name: "Bugün", exact: true }),
  ).toBeVisible();
  expect(reads.filter((row) => row.operation === "calendar_get_v1")).toHaveLength(2);
  expect(reads.filter((row) => row.operation === "earnings_list_v1")).toHaveLength(2);
  expect(
    reads.filter((row) =>
      [
        "person_get_v1",
        "finance_get_v1",
        "entitlements_get_v1",
        "people_list_v1",
        "reservation_list_v1",
      ].includes(row.operation),
    ),
  ).toEqual([]);
});
test("denied own earnings remain unknown while assigned sessions stay readable", async ({
  page,
}) => {
  await fixture(page, "earnings-denied");
  await expect(page.getByText("Sentetik atanmış 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Bu bilgiyi görme yetkisi yok.", { exact: true })).toBeVisible();
  await expect(page.getByText("Henüz hakediş yok", { exact: true })).toHaveCount(0);
});
test("owner role does not manufacture self instructor scope", async ({ page }) => {
  const { reads } = await fixture(page, "no-instructor");
  await expect(
    page.getByText("Bu merkezde bağlı eğitmen kapsamı bulunmuyor.", { exact: true }),
  ).toBeVisible();
  expect(
    reads.filter((row) =>
      ["calendar_get_v1", "session_get_v1", "earnings_list_v1"].includes(row.operation),
    ),
  ).toEqual([]);
});
test("denied assigned calendar does not become an empty day", async ({ page }) => {
  const { permitCalendar } = await fixture(page, "list-denied");
  await expect(
    page.getByText("Güncel atanmış seanslar okunamadı.", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Bugün seansın yok.", { exact: true })).toHaveCount(0);
  permitCalendar();
  await page.getByRole("button", { name: "Yeniden oku", exact: true }).click();
  await expect(page.getByText("Sentetik atanmış 1", { exact: true })).toBeVisible();
});
