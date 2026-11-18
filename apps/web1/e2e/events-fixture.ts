import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type {
  EventView,
  RequestEventSave,
  ProductView,
} from "../src/lib/api-contracts/generated.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
export const eventId = "019ab7b0-0000-7000-8000-000000000090";
export const product: ProductView = {
  id: "019ab7b0-0000-7000-8000-000000000091",
  version_id: "019ab7b0-0000-7000-8000-000000000092",
  terms: {
    name: "Pratik paketi",
    kind: "credits",
    booking_mode: "flexible",
    credits: 8,
    price_minor: "120000",
    currency: "TRY",
    quota: null,
    freeze: { enabled: false, extends_validity: false },
    refund: { method: "credit_ratio" },
    scopes: [
      {
        scope_kind: "center_discipline",
        center_id: I.center,
        discipline_id: I.discipline,
        usage_targets: ["lesson", "event"],
      },
    ],
  },
};
export const event: EventView = {
  id: eventId,
  center_id: I.center,
  name: "Tango atölyesi",
  interval: { starts_at: "2026-11-20T15:00:00Z", ends_at: "2026-11-20T16:00:00Z" },
  timezone: "Europe/Istanbul",
  venue: { kind: "internal", room_id: I.room, timezone: "Europe/Istanbul" },
  terms: {
    fee_minor: "45000",
    currency: "TRY",
    full_payment_required: false,
    allowed_product_version_ids: [],
    cancellation: { before_cutoff: "release", after_cutoff: "consume", no_show: "consume" },
    refund: { method: "none" },
  },
  capacity: { nominal: 10, maximum: 16 },
  assignments: [],
  assignment_terms: [],
  discipline_ids: [I.discipline],
  version: 1,
  state: "draft",
  attendance_state: "open",
};
export async function mockEvents(
  page: Page,
  mode: "normal" | "unknown" | "result" | "denied" | "empty" | "directory" | "starter" = "normal",
  options: { limited?: boolean; missingPayments?: boolean } = {},
) {
  await mockStudio(page);
  await page.clock.install({ time: new Date("2026-11-16T12:00:00Z") });
  const state = {
    events:
      mode === "empty"
        ? []
        : mode === "directory"
          ? Array.from({ length: 21 }, (_, i) => ({
              ...structuredClone(event),
              id: `019ab7b0-0000-7000-8000-${String(200 + i).padStart(12, "0")}`,
              name: `Tango ${i}`,
              state: i % 2 === 0 ? ("published" as const) : ("draft" as const),
              active_registration_count: i % 2 === 0 ? 2 : 0,
            }))
          : [structuredClone(event)],
    writes: [] as RequestEventSave[],
    reads: [] as Record<string, unknown>[],
    effects: 0,
    failResult: 0,
    unknownSent: false,
  };
  const keys = new Map<string, string>();
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (
      [
        "event_list_v1",
        "event_get_v1",
        "event_save_v1",
        "operation_status_get_v1",
        "products_list_v1",
      ].includes(op ?? "")
    ) {
      if (r.org_id) expect(r.org_id).toBe(I.org);
      if (r.center_id) expect(r.center_id).toBe(I.center);
    }
    if (op === "event_list_v1") {
      state.reads.push(r);
      if (mode === "denied" || mode === "starter")
        return route.fulfill({
          status: 403,
          json: {
            ok: false,
            error: {
              code: mode === "starter" ? "PLAN_FEATURE_UNAVAILABLE" : "FORBIDDEN",
              retryable: false,
              trace_id: I.role,
            },
          },
        });
      expect(r.page).toMatchObject({ limit: 20, sort: "starts_at_asc" });
      const scoped = state.events.filter(
        (e) =>
          Date.parse(e.interval.starts_at) < Date.parse(r.interval.ends_at) &&
          Date.parse(e.interval.ends_at) > Date.parse(r.interval.starts_at) &&
          (!r.query ||
            e.name.toLocaleLowerCase("tr").includes(String(r.query).toLocaleLowerCase("tr"))) &&
          (!options.limited || e.state === "published"),
      );
      const filtered = scoped.filter(
        (e) => !r.status || r.status === "all" || e.state === r.status,
      );
      const offset = r.page.cursor ? 20 : 0;
      return send({
        items: filtered.slice(offset, offset + 20).map((e) => {
          const projected = { ...e };
          if (r.include_summary)
            projected.active_registration_count = e.active_registration_count ?? 0;
          else delete projected.active_registration_count;
          return projected;
        }),
        as_of: "2026-11-16T12:00:00Z",
        next_cursor: filtered.length > offset + 20 ? "directory-next" : null,
        ...(r.include_summary
          ? {
              summary: {
                published: scoped.filter((e) => e.state === "published").length,
                draft: scoped.filter((e) => e.state === "draft").length,
                occurred: scoped.filter((e) => e.state === "occurred").length,
                cancelled: scoped.filter((e) => e.state === "cancelled").length,
                published_active_registrations: scoped
                  .filter((e) => e.state === "published")
                  .reduce((n, e) => n + (e.active_registration_count ?? 0), 0),
                unresolved_payment_registrations: options.missingPayments ? 1 : 0,
                pending_payments:
                  options.missingPayments || !scoped.some((e) => e.state === "published")
                    ? []
                    : [
                        { currency: "TRY", remaining_minor: "90000", registration_count: 2 },
                        { currency: "USD", remaining_minor: "20000", registration_count: 1 },
                      ],
              },
            }
          : {}),
      });
    }
    if (op === "roles_list_v1" && options.limited)
      return send({ items: [], next_cursor: null, as_of: "2026-11-16T12:00:00Z" });
    if (op === "event_get_v1") {
      if (state.failResult > 0) {
        state.failResult--;
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            error: { code: "SERVICE_UNAVAILABLE", retryable: true, trace_id: I.role },
          },
        });
      }
      const e = state.events.find((row) => row.id === r.event_id);
      return e
        ? send(e)
        : route.fulfill({
            status: 404,
            json: { ok: false, error: { code: "NOT_FOUND", retryable: false, trace_id: I.role } },
          });
    }
    if (op === "products_list_v1")
      return send({ items: [product], next_cursor: null, as_of: "2026-11-16T12:00:00Z" });
    if (op === "event_save_v1") {
      state.writes.push(r);
      let id = keys.get(r.operation_key);
      if (!id) {
        const before = state.events.find((row) => row.id === r.event_id);
        if (before && before.version !== r.expected_version)
          return route.fulfill({
            status: 409,
            json: {
              ok: false,
              error: { code: "VERSION_CONFLICT", retryable: false, trace_id: I.role },
            },
          });
        id = before?.id ?? "019ab7b0-0000-7000-8000-000000000093";
        const result: EventView = {
          id,
          center_id: I.center,
          name: r.name,
          interval: r.interval,
          timezone: r.timezone,
          venue: r.venue,
          capacity: r.capacity,
          terms: r.terms,
          discipline_ids: r.discipline_ids,
          state: before?.state ?? "draft",
          attendance_state: "open",
          assignments: r.assignments.map(
            ({ person_id, duty }: { person_id: string; duty: "instructor" | "assistant" }) => ({
              person_id,
              duty,
            }),
          ),
          assignment_terms: r.assignments,
          version: (before?.version ?? 0) + 1,
        };
        state.events = state.events.filter((row) => row.id !== id);
        state.events.push(result);
        keys.set(r.operation_key, id);
        state.effects++;
        if (mode === "unknown" && !state.unknownSent) {
          state.unknownSent = true;
          return route.abort("failed");
        }
        if (mode === "result") state.failResult = 1;
      }
      return send({
        operation_id: I.role,
        primary_id: id,
        version: state.events.find((e) => e.id === id)!.version,
        applied: true,
      });
    }
    if (op === "operation_status_get_v1" && r.operation === "event_save_v1")
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: "events", id: keys.get(r.key) },
      });
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/events`);
  await expect(page.getByRole("heading", { name: "Etkinlikler", exact: true })).toBeVisible();
  return state;
}
export async function openEvent(page: Page) {
  await page.getByRole("row", { name: /Tango atölyesi/ }).click();
  await page.getByRole("button", { name: "Düzenle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Başlık", { exact: true })).toHaveValue("Tango atölyesi");
  return dialog;
}
export async function reviewEvent(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("checkbox", { name: "Şartları, görevlileri ve etkilerini inceledim.", exact: true })
    .press("Space");
}
