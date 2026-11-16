import { expect, type Page } from "@playwright/test";
import type { LessonRequestView } from "../src/lib/api-contracts/generated.js";
import { mockOwnReservations } from "./member-reservations-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
export async function mockOwnPrivateLessons(
  page: Page,
  options: {
    unknown?: boolean;
    ackUnread?: boolean;
    stale?: boolean;
    denied?: boolean;
    catalogDenied?: boolean;
  } = {},
) {
  await mockOwnReservations(page);
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toBeVisible();
  const requests: LessonRequestView[] = [0, 1].map((index) => ({
    id: id(300 + index),
    center_id: I.center,
    person_id: I.self,
    discipline_id: I.discipline,
    format: "private",
    created_at: "2026-11-15T12:00:00Z",
    requested_start: `2026-11-${18 + index}T13:00:00Z`,
    duration_minutes: 45,
    preferred_instructor_id: I.instructor,
    version: 2,
    state: index === 0 ? "pending" : "alternative_offered",
    alternatives:
      index === 0
        ? []
        : [
            {
              id: id(302),
              request_id: id(301),
              created_at: "2026-11-15T12:00:00Z",
              starts_at: "2026-11-19T14:00:00Z",
              ends_at: "2026-11-19T14:45:00Z",
              instructor_id: I.instructor,
              state: "offered",
              version: 1,
            },
          ],
  }));
  const writes: { operation: string; request: Record<string, unknown> }[] = [],
    reads: { operation: string; request: Record<string, unknown> }[] = [];
  let denied = Boolean(options.denied),
    catalogDenied = Boolean(options.catalogDenied),
    bumped = false,
    unread = Boolean(options.ackUnread),
    lastId: string | undefined;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!,
      req = route.request().postDataJSON();
    reads.push({ operation, request: req });
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      reject = () =>
        route.fulfill({
          status: 403,
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
    const item = (row: LessonRequestView) => ({
      operation: req.operation,
      exists: true,
      entity: { type: "lesson_requests", id: row.id },
      state: row.state,
      versions: [{ entity: { type: "lesson_requests", id: row.id }, version: row.version }],
      request_detail: row,
      as_of: "2026-11-16T12:00:00Z",
    });
    if (
      operation === "management_state_get_v1" &&
      ["lesson_request_create_v1", "lesson_request_withdraw_v1"].includes(req.operation)
    ) {
      expect(req.center_id).toBe(I.center);
      const key = req.selector.key;
      if (key.catalog) {
        expect(key.person_id).toBe(I.self);
        if (catalogDenied) return reject();
        const discipline = key.catalog === "disciplines",
          entity = {
            type: discipline ? "disciplines" : "people",
            id: discipline ? I.discipline : I.instructor,
          };
        return send({
          items: [
            {
              operation: req.operation,
              exists: true,
              entity,
              state: "active",
              versions: [{ entity, version: 1 }],
              current: {
                operation: req.operation,
                values: {
                  [discipline ? "discipline_id" : "preferred_instructor_id"]: entity.id,
                  display_name: discipline ? "Tango" : "Örnek Eğitmen",
                },
              },
              as_of: "2026-11-16T12:00:00Z",
            },
          ],
          next_cursor: null,
          as_of: "2026-11-16T12:00:00Z",
        });
      }
      if (key.lesson_request_id) {
        const row = requests.find((row) => row.id === key.lesson_request_id)!;
        if (unread && lastId) {
          unread = false;
          return route.fulfill({
            status: 500,
            json: {
              ok: false,
              error: { code: "VALIDATION_FAILED", retryable: false, trace_id: I.role },
            },
          });
        }
        if (options.stale && !bumped) {
          row.version++;
          bumped = true;
        }
        return send({ items: row ? [item(row)] : [], next_cursor: null });
      }
      expect(key.person_id).toBe(I.self);
      if (denied) return reject();
      return send({ items: requests.map(item), next_cursor: null });
    }
    if (
      [
        "lesson_request_create_v1",
        "lesson_request_withdraw_v1",
        "lesson_request_accept_alternative_v1",
      ].includes(operation)
    ) {
      writes.push({ operation, request: req });
      if (operation === "lesson_request_create_v1") {
        expect(req.person_id).toBe(I.self);
        expect(req.discipline_id).toBe(I.discipline);
        lastId = id(304);
        if (!requests.some((row) => row.id === lastId))
          requests.push({
            id: lastId,
            center_id: I.center,
            person_id: I.self,
            discipline_id: req.discipline_id,
            format: "private",
            created_at: "2026-11-16T12:00:00Z",
            requested_start: req.requested_start,
            duration_minutes: req.duration_minutes,
            preferred_instructor_id: req.preferred_instructor_id ?? null,
            state: "pending",
            version: 1,
            alternatives: [],
          });
      } else {
        const row = requests.find((row) => row.id === req.lesson_request_id)!;
        expect(req.expected_version).toBe(row.version);
        lastId = row.id;
        row.version++;
        if (operation === "lesson_request_withdraw_v1") row.state = "withdrawn";
        else {
          const alternative = row.alternatives.find((item) => item.id === req.alternative_id)!;
          alternative.state = "accepted";
          alternative.version++;
          alternative.selected_at = "2026-11-16T12:00:00Z";
        }
      }
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({ primary_id: lastId, versions: [], job_ids: [] });
    }
    if (operation === "operation_status_get_v1")
      return send({
        operation: req.operation,
        key: req.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: "lesson_requests", id: lastId },
      });
    return route.fallback();
  });
  await page
    .getByRole("navigation", { name: "Üye menüsü", exact: true })
    .getByRole("link", { name: "Özel ders", exact: true })
    .click();
  await expect(page).toHaveURL(`${origin}/member/private-lessons?org=${I.org}&center=${I.center}`);
  await expect(page.getByRole("heading", { name: "Özel ders", exact: true })).toBeVisible();
  return {
    requests,
    writes,
    reads,
    setDenied: (value: boolean) => {
      denied = value;
    },
    setCatalogDenied: (value: boolean) => {
      catalogDenied = value;
    },
  };
}
export async function openOwnRequestForm(page: Page) {
  await page.getByRole("button", { name: "Yeni talep", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Disiplin", exact: true }).selectOption(I.discipline);
  await dialog.getByLabel("Tarih", { exact: true }).fill("2026-11-20");
  await dialog.getByLabel("Başlangıç", { exact: true }).fill("16:00");
  return dialog;
}
