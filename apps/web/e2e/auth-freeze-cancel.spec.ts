import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type {
  EntitlementView,
  TableFreezes,
  FreezeCancellationPreview,
} from "@ftksaas/api-contracts";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
const sale = "019a7b00-0000-7000-8000-000000000070",
  freezeId = "019a7b00-0000-7000-8000-000000000072",
  previewId = "019a7b00-0000-7000-8000-000000000073",
  reservation = "019a7b00-0000-7000-8000-000000000074";
async function setup(
  page: Page,
  options: { denied?: boolean; unknown?: boolean; unread?: boolean; stale?: boolean } = {},
) {
  const studio = await mockStudio(page),
    writes: Record<string, any>[] = [],
    previews: Record<string, any>[] = [],
    receipts: Record<string, any>[] = [],
    shortening: Record<string, any>[] = [];
  let saved = false,
    failedRead = false,
    reservationVersion = 2;
  const record: TableFreezes = {
    id: freezeId,
    org_id: I.org,
    sale_id: sale,
    created_at: "2026-11-16T00:00:00Z",
    version: 1,
    starts_at: "2099-01-11T21:00:00Z",
    planned_end: "2099-01-13T21:00:00Z",
    state: "scheduled",
    preview_id: previewId,
    actual_end: null,
    extension_until: "2099-01-30T21:00:00Z",
  };
  const row: EntitlementView = {
    sale_id: sale,
    person_id: I.instructor,
    account_id: I.account,
    version: 1,
    sale_version: 1,
    sale_state: "active",
    start_date: "2026-11-15",
    end_date: "2099-01-31",
    timezone: "Europe/Istanbul",
    state: "active",
    available: 7,
    reserved: 1,
    consumed: 0,
    deficit: 0,
    quotas: [],
    deficit_scopes: [],
    kind: "credits",
    booking_mode: "flexible",
    freezes: [{ ...record }],
  };
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON(),
      send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      fail = (code: string) =>
        route.fulfill({
          json: {
            ok: false,
            error: { code, retryable: code === "TEMPORARY_FAILURE", trace_id: I.role },
          },
        });
    if (op === "products_list_v1")
      return send({ items: [], next_cursor: null, as_of: "2026-11-16T10:00:00Z" });
    if (op === "entitlements_get_v1") {
      expect(req.person_id).toBe(I.instructor);
      expect(req.center_id).toBe(I.center);
      if (saved && options.unread && !failedRead) {
        failedRead = true;
        return fail("TEMPORARY_FAILURE");
      }
      return send([row]);
    }
    if (op === "management_state_get_v1" && req.operation === "reservation_cancel_v1") {
      expect(req.selector).toEqual({
        operation: "reservation_cancel_v1",
        key: { reservation_id: reservation },
      });
      return send({
        items: [
          {
            exists: true,
            operation: req.operation,
            entity: { type: "reservations", id: reservation },
            state: "active",
            current: { operation: req.operation, values: { reservation_id: reservation } },
            versions: [
              { entity: { type: "reservations", id: reservation }, version: reservationVersion },
            ],
          },
        ],
        next_cursor: null,
        as_of: "2026-11-16T10:00:00Z",
      });
    }
    if (op === "freeze_cancel_preview_v1") {
      previews.push(req);
      expect(req.freeze_id).toBe(freezeId);
      expect(req.reason).toBe("Sentetik plan iptali");
      expect(req).not.toHaveProperty("end_date");
      expect(req).not.toHaveProperty("dates");
      if (options.denied) return fail("FORBIDDEN");
      const quote: FreezeCancellationPreview = {
        id: previewId,
        token: "synthetic-cancel-capability",
        scope_hash: "synthetic",
        dependencies: {
          versions: [{ entity: { type: "freezes", id: freezeId }, version: 1 }],
          policy_hashes: [],
          permission_hash: "synthetic",
        },
        effects: [
          { entity: { type: "freezes", id: freezeId }, action: "cancel" },
          { entity: { type: "sales", id: sale }, action: "adjust", quantity: 2 },
          { entity: { type: "reservations", id: reservation }, action: "adjust" },
        ],
        blockers: [],
        expires_at: "2099-01-01T00:00:00Z",
        freeze_cancellation: {
          freeze_id: freezeId,
          sale_id: sale,
          state: "cancelled",
          removed_extension_days: 2,
          previous_end_date: "2099-01-31",
          end_date: "2099-01-29",
          valid_until: "2099-01-28T21:00:00Z",
          preserves_reservations: true,
        },
      };
      return send(quote);
    }
    if (op === "freeze_cancel_apply_v1") {
      writes.push(req);
      expect(req.org_id).toBe(I.org);
      expect(req.center_id).toBe(I.center);
      expect(req.preview).toEqual({ id: previewId, token: "synthetic-cancel-capability" });
      expect(req).not.toHaveProperty("end_date");
      expect(req).not.toHaveProperty("expected_version");
      if (options.stale) return fail("PREVIEW_STALE");
      if (!saved) {
        saved = true;
        reservationVersion++;
        row.version = 2;
        row.sale_version = 2;
        row.end_date = "2099-01-29";
        row.freezes = [{ ...record, version: 2, state: "cancelled", extension_until: null }];
      }
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({ primary_id: freezeId, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1") {
      receipts.push(req);
      expect(req.operation).toBe("freeze_cancel_apply_v1");
      expect(req.key).toBe(writes[0].operation_key);
      if (receipts.length === 1) return fail("TEMPORARY_FAILURE");
      return send({
        operation: req.operation,
        key: req.key,
        status: "result_expired",
        result_available: false,
        result_reference: null,
      });
    }
    if (op === "freeze_end_preview_v1" || op === "freeze_end_apply_v1") {
      shortening.push(req);
      return fail("VALIDATION_FAILED");
    }
    return route.fallback();
  });
  await page.goto(origin + "/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(origin + "/account");
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/people/${I.instructor}`);
  await page.getByRole("button", { name: common.memberProfile.cancelFreeze, exact: true }).click();
  const panel = page.getByRole("dialog", {
    name: common.memberProfile.titles.cancelFreeze,
    exact: true,
  });
  await panel.getByLabel(common.memberProfile.reason, { exact: true }).fill("Sentetik plan iptali");
  return { studio, writes, previews, receipts, shortening, row, panel, record };
}
async function review(state: Awaited<ReturnType<typeof setup>>) {
  await state.panel.getByRole("button", { name: common.memberProfile.review, exact: true }).click();
}
async function approve(state: Awaited<ReturnType<typeof setup>>) {
  await state.panel
    .getByRole("checkbox", { name: common.memberProfile.accepted, exact: true })
    .press("Space");
  await state.panel.getByRole("button", { name: "Uygula", exact: true }).click();
}
test("mobile planned freeze cancellation reviews exact native extension removal and preserves interval and booked rights", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await setup(page);
  await expect(state.panel.getByLabel("Bitiş", { exact: true })).toHaveCount(0);
  await expect(state.panel.getByLabel("Başlangıç", { exact: true })).toHaveCount(0);
  await review(state);
  await expect(state.panel.getByText("2099-01-31 → 2099-01-29", { exact: true })).toBeVisible();
  await expect(state.panel.getByText(/Kaldırılan uzatma: 2 gün/)).toBeVisible();
  await expect(state.panel.getByRole("button", { name: "Uygula", exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  expect((await scanAccessibility(page, "freeze-cancel-review")).violations).toEqual([]);
  await approve(state);
  await expect(
    state.panel.getByText(common.memberProfile.freezeSaved, { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.shortening).toHaveLength(0);
  expect(state.row.available).toBe(7);
  expect(state.row.reserved).toBe(1);
  expect(state.row.freezes![0]).toMatchObject({
    state: "cancelled",
    actual_end: null,
    starts_at: state.record.starts_at,
    planned_end: state.record.planned_end,
  });
  await state.panel.getByRole("button", { name: common.memberProfile.close, exact: true }).click();
  await expect(
    page.getByText(common.memberProfile.freezeStates.cancelled, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: common.memberProfile.cancelFreeze, exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
});
test("native freeze cancellation denial cannot become shortening or an enabled apply", async ({
  page,
}) => {
  const state = await setup(page, { denied: true });
  await review(state);
  await expect(
    state.panel.getByText(common.memberProfile.freezeReadError, { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  expect(state.shortening).toHaveLength(0);
});
test("unknown freeze cancellation keeps the intent across receipt failure and recovers an expired receipt from its known native target", async ({
  page,
}) => {
  const state = await setup(page, { unknown: true });
  await review(state);
  await approve(state);
  await expect(state.panel.getByText(common.finance.unknownWrite, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(state.panel).toBeVisible();
  await state.panel.getByRole("button", { name: common.finance.readResult, exact: true }).click();
  await expect.poll(() => state.receipts.length).toBe(1);
  await expect(state.panel.getByText(common.finance.unknownWrite, { exact: true })).toBeVisible();
  await state.panel.getByRole("button", { name: common.finance.readResult, exact: true }).click();
  await expect(
    state.panel.getByText(common.memberProfile.freezeSaved, { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.previews).toHaveLength(1);
  expect(new Set(state.receipts.map((row) => row.key)).size).toBe(1);
});
test("acknowledged freeze cancellation recovers current rights without another writer", async ({
  page,
}) => {
  const state = await setup(page, { unread: true });
  await review(state);
  await approve(state);
  await expect(
    state.panel.getByText(common.memberProfile.freezeUnread, { exact: true }),
  ).toBeVisible();
  await expect(
    state.panel.getByRole("button", { name: common.finance.retrySame, exact: true }),
  ).toHaveCount(0);
  await state.panel.getByRole("button", { name: common.finance.readResult, exact: true }).click();
  await expect(
    state.panel.getByText(common.memberProfile.freezeSaved, { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.receipts).toHaveLength(0);
});
test("stale freeze cancellation requires a new explicit review and never falls through to early end", async ({
  page,
}) => {
  const state = await setup(page, { stale: true });
  await review(state);
  await approve(state);
  await expect(
    state.panel.getByText(common.memberProfile.freezeStale, { exact: true }),
  ).toBeVisible();
  await expect(state.panel.getByRole("button", { name: "Uygula", exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  expect(state.shortening).toHaveLength(0);
});
