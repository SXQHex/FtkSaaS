import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type {
  ProductView,
  SalePreview,
  EntitlementView,
  NegativeLimitsView,
  ReservationProtectionPreview,
  TableFreezes,
} from "../src/lib/api-contracts/generated.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
const versionId = "019a7b00-0000-7000-8000-000000000022",
  productId = "019a7b00-0000-7000-8000-000000000021",
  saleId = "019a7b00-0000-7000-8000-000000000070",
  previewId = "019a7b00-0000-7000-8000-000000000071",
  secondPreviewId = "019a7b00-0000-7000-8000-000000000073",
  debtId = "019a7b00-0000-7000-8000-000000000074";
async function setup(
  page: Page,
  options: {
    timed?: boolean;
    blocked?: boolean;
    unknown?: boolean;
    unread?: boolean;
    stale?: boolean;
    discounted?: boolean;
    rejectDiscount?: boolean;
    scoped?: boolean;
    openSale?: boolean;
    existingRights?: boolean;
    freezeEnabled?: boolean;
    existingFreeze?: "active" | "scheduled";
    freezeBinding?: boolean;
  } = {},
) {
  await mockStudio(page);
  const writes: Record<string, unknown>[] = [],
    previews: Record<string, unknown>[] = [];
  let saved = false,
    readFailed = false;
  const p: ProductView = {
    id: productId,
    version_id: versionId,
    terms: {
      name: options.timed ? "Sentetik haftalık paket" : "Sentetik 8 ders",
      kind: options.timed ? "timed" : "credits",
      booking_mode: "flexible",
      credits: options.timed ? null : 8,
      price_minor: "100000",
      currency: "TRY",
      freeze: {
        enabled: Boolean(options.freezeEnabled),
        extends_validity: Boolean(options.freezeEnabled),
        ...(options.freezeEnabled ? { max_days: 7 } : {}),
      },
      refund: { method: options.timed ? "time_ratio" : "credit_ratio" },
      quota: options.timed ? { period: "week", limit: 2 } : null,
      scopes: options.scoped
        ? [
            {
              scope_kind: "center_discipline",
              discipline_id: I.discipline,
              center_id: I.center,
              usage_targets: ["lesson"],
            },
          ]
        : [
            {
              scope_kind: "center_all_disciplines",
              discipline_id: null,
              center_id: I.center,
              usage_targets: ["lesson"],
            },
          ],
    },
  };
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      reject = (code: string, retryable = false) =>
        route.fulfill({ json: { ok: false, error: { code, retryable, trace_id: I.role } } });
    if (op === "products_list_v1")
      return send({ items: [p], next_cursor: null, as_of: new Date().toISOString() });
    if (op === "entitlements_get_v1") {
      expect(req.person_id).toBe(I.instructor);
      expect(req.include_timed_rights).toBe(true);
      const row: EntitlementView = {
        sale_id: saleId,
        person_id: I.instructor,
        product_version_id: versionId,
        start_date: "2026-11-15",
        end_date: "2026-11-22",
        timezone: "Europe/Istanbul",
        state: "active",
        available: options.timed ? 0 : options.freezeBinding ? 7 : 8,
        reserved: options.freezeBinding ? 1 : 0,
        consumed: 0,
        deficit: 0,
        quotas: [],
        deficit_scopes: [],
        kind: p.terms.kind,
        booking_mode: "flexible",
        version: 1,
        account_id: debtId,
        sale_state: "active",
        freezes: options.existingFreeze ? [profileFreezeRecord(options.existingFreeze)] : [],
        sale_version: 1,
      };
      return send(saved || options.existingRights ? [row] : []);
    }
    if (op === "finance_get_v1") {
      expect(req.person_id).toBe(I.instructor);
      expect(req.currency).toBe("TRY");
      if (options.unread && saved && !readFailed) {
        readFailed = true;
        return reject("TEMPORARY_FAILURE", true);
      }
      return send({
        person_id: I.instructor,
        currency: "TRY",
        credit_available_minor: "0",
        debts: saved
          ? [
              {
                id: debtId,
                remaining_minor: options.discounted ? "75000" : "100000",
                due_at: "2026-11-15T00:00:00Z",
                center_id: I.center,
                version: 1,
              },
            ]
          : [],
        movements: { items: [], next_cursor: null, as_of: new Date().toISOString() },
      });
    }
    if (op === "sale_preview_v1") {
      previews.push(req);
      if (options.rejectDiscount && req.net_minor !== undefined) return reject("FORBIDDEN");
      expect(req).toMatchObject({
        person_id: I.instructor,
        product_version_id: versionId,
        start_date: "2026-11-15",
        end_date: "2026-11-22",
      });
      expect(req).not.toHaveProperty("payment");
      if (options.discounted) expect(req.net_minor).toBe("75000");
      else expect(req).not.toHaveProperty("net_minor");
      const result: SalePreview = {
        id: previews.length === 1 ? previewId : secondPreviewId,
        token: previews.length === 1 ? "synthetic-capability-1" : "synthetic-capability-2",
        scope_hash: "synthetic",
        dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
        effects: [],
        blockers: options.blocked
          ? [{ code: "DOCUMENT_REQUIRED", retryable: false, trace_id: I.role }]
          : [],
        expires_at: "2099-01-01T00:00:00Z",
        sale: {
          person_id: I.instructor,
          product_version_id: versionId,
          kind: p.terms.kind,
          booking_mode: "flexible",
          start_date: req.start_date,
          end_date: req.end_date,
          timezone: "Europe/Istanbul",
          valid_from: "2026-11-14T21:00:00Z",
          valid_until: "2026-11-22T21:00:00Z",
          debt_minor: options.discounted ? "75000" : "100000",
          currency: "TRY",
          granted: options.timed ? 0 : 8,
          available: options.timed ? 0 : 8,
          reserved: 0,
          consumed: 0,
          quota: options.timed ? { period: "week", limit: 2 } : null,
          deficits: [],
        },
      };
      return send(result);
    }
    if (op === "sale_apply_v1") {
      writes.push(req);
      if (options.stale && writes.length === 1) return reject("PREVIEW_STALE");
      saved = true;
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({ primary_id: saleId, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1") return reject("NOT_FOUND");
    return route.fallback();
  });
  await page.goto(origin + "/login");
  await page.getByLabel("E-posta", { exact: true }).fill("synthetic@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(origin + "/account");
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/people/${I.instructor}`);
  await expect(page.getByRole("heading", { name: "Örnek Eğitmen", exact: true })).toBeVisible();
  const panel = page.getByRole("dialog");
  if (options.openSale !== false) {
    await page.getByRole("button", { name: "Paket / hak tahsis et", exact: true }).click();
    await expect(panel).toHaveAccessibleName("Paket / hak tahsis et");
  }
  return { writes, previews, panel };
}
async function review(page: Page, options: Parameters<typeof setup>[1] = {}) {
  const state = await setup(page, options),
    { panel } = state;
  await panel
    .getByRole("radio", {
      name: options?.timed ? "Sentetik haftalık paket" : "Sentetik 8 ders",
      exact: true,
    })
    .press("Space");
  await expect(
    panel.getByRole("radio", {
      name: options?.timed ? "Sentetik haftalık paket" : "Sentetik 8 ders",
      exact: true,
    }),
  ).toBeChecked();
  await panel.getByLabel("Başlangıç", { exact: true }).fill("2026-11-15");
  await panel.getByLabel("Bitiş", { exact: true }).fill("2026-11-22");
  if (options?.discounted)
    await panel.getByLabel("Satış bedeli (alt birim, isteğe bağlı)", { exact: true }).fill("75000");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true })).toBeVisible();
  return state;
}
async function approve(panel: ReturnType<Page["getByRole"]>) {
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await expect(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true })).toBeChecked();
  await panel.getByRole("button", { name: "Uygula", exact: true }).click();
}
test("mobile native sale reviews exact debt/rights even with empty effects then rereads the new sale", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const { panel, writes, previews } = await setup(page);
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByText("Uygun bir paket sürümü seç.", { exact: true })).toBeVisible();
  expect(previews).toHaveLength(0);
  await expect(panel.getByRole("radio", { name: "Sentetik 8 ders", exact: true })).toBeFocused();
  await panel.getByRole("radio", { name: "Sentetik 8 ders", exact: true }).press("Space");
  await expect(panel.getByRole("radio", { name: "Sentetik 8 ders", exact: true })).toBeChecked();
  await panel.getByLabel("Başlangıç", { exact: true }).fill("2026-11-15");
  await panel.getByLabel("Bitiş", { exact: true }).fill("2026-11-22");
  expect((await scanAccessibility(page, "sale-editor")).violations).toEqual([]);
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Uygula", exact: true })).toBeDisabled();
  expect(writes).toHaveLength(0);
  await expect(panel.getByText("₺1.000,00", { exact: true })).toBeVisible();
  expect((await scanAccessibility(page, "sale-native-review")).violations).toEqual([]);
  await approve(panel);
  await expect(
    panel.getByText("Satış ve güncel hak/finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(previews).toHaveLength(1);
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByText("Sentetik 8 ders", { exact: true })).toBeVisible();
  await expect(
    page.locator("[data-profile-metrics]").getByText("₺1.000,00", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Para birimi", { exact: true })).toHaveValue("TRY");
  await expect(page.getByText("kullanılabilir:", { exact: false })).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
});
test("timed weekly quota is not presented as zero usable rights", async ({ page }) => {
  const { panel, writes } = await review(page, { timed: true });
  await expect(panel.getByText("2 · Haftalık", { exact: true })).toBeVisible();
  await expect(panel.getByText("Kullanılabilir", { exact: true })).toHaveCount(0);
  await approve(panel);
  await expect(
    panel.getByText("Satış ve güncel hak/finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
});
test("document-required preview cannot apply even after checking approval", async ({ page }) => {
  const { panel, writes } = await review(page, { blocked: true });
  await expect(
    panel.getByText(
      "Üyenin gerekli belgeleri kendi hesabından kabul etmesi gerekiyor. Onaydan sonra yeni satış önizlemesi alınmalı.",
      { exact: true },
    ),
  ).toBeVisible();
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await expect(panel.getByRole("button", { name: "Uygula", exact: true })).toBeDisabled();
  expect(writes).toHaveLength(0);
});
test("unknown sale preserves the reviewed key/capability after failed receipt read", async ({
  page,
}) => {
  const { panel, writes, previews } = await review(page, { unknown: true });
  await approve(panel);
  const retry = panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true });
  await expect(retry).toBeVisible();
  await panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(retry).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await retry.click();
  await expect(
    panel.getByText("Satış ve güncel hak/finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(previews).toHaveLength(1);
  const [a, b] = writes;
  expect(a!.request_id).not.toBe(b!.request_id);
  expect({ ...a, request_id: null }).toEqual({ ...b, request_id: null });
});
test("an ACK with a failed finance reread recovers without another apply", async ({ page }) => {
  const { panel, writes } = await review(page, { unread: true });
  await approve(panel);
  await expect(
    panel.getByText("Satış alındı; güncel hak/finans henüz okunamadı.", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    panel.getByText("Satış ve güncel hak/finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
});
test("stale sale needs a new native preview and a fresh explicit approval", async ({ page }) => {
  const { panel, writes, previews } = await review(page, { stale: true });
  await approve(panel);
  await expect(
    panel.getByText("Önizleme güncel değil veya süresi doldu. Yeni önizleme alıp yeniden onayla.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: "Uygula", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "Geri", exact: true }).click();
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }),
  ).not.toBeChecked();
  await approve(panel);
  await expect(
    panel.getByText("Satış ve güncel hak/finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(previews).toHaveLength(2);
  expect(writes[0]!.operation_key).not.toBe(writes[1]!.operation_key);
  expect(writes[0]!.preview).not.toEqual(writes[1]!.preview);
});

test("discounted timed sale reviews native debt, resets approval on edit and displays immutable quota without buckets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const { panel, previews, writes } = await review(page, {
    timed: true,
    discounted: true,
    scoped: true,
  });
  await expect(panel.getByText("₺1.000,00", { exact: true })).toBeVisible();
  await expect(panel.getByText("₺750,00", { exact: true })).toBeVisible();
  await expect(
    panel.getByText(
      "Esnek; 2 · Haftalık kullanım sınırı; Fixture Center · Tango · Grup ve özel dersler",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(panel.getByText("2 · Haftalık", { exact: true })).toBeVisible();
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await expect(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true })).toBeChecked();
  await panel.getByRole("button", { name: "Geri", exact: true }).click();
  const price = panel.getByLabel("Satış bedeli (alt birim, isteğe bağlı)", { exact: true });
  await price.fill("-1");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(price).toBeFocused();
  await expect(price).toHaveAttribute("aria-invalid", "true");
  await expect(price).toHaveAttribute(
    "aria-describedby",
    "member-netMinor-hint member-netMinor-error",
  );
  expect(previews).toHaveLength(1);
  expect(writes).toHaveLength(0);
  await price.fill("75000");
  await expect(price).toHaveAttribute("aria-invalid", "false");
  await expect(price).toHaveAttribute("aria-describedby", "member-netMinor-hint");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }),
  ).not.toBeChecked();
  await expect(panel.getByRole("button", { name: "Uygula", exact: true })).toBeDisabled();
  expect((await scanAccessibility(page, "discounted-timed-review")).violations).toEqual([]);
  await approve(panel);
  await expect(
    panel.getByText("Satış ve güncel hak/finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(previews).toHaveLength(2);
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByText("2 · Haftalık kullanım sınırı", { exact: true })).toBeVisible();
  await expect(
    page.locator("[data-profile-metrics]").getByText("₺750,00", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
});

test("a native forbidden custom price cannot become an apply or bypass the provider price policy", async ({
  page,
}) => {
  const { panel, writes, previews } = await setup(page, { timed: true, rejectDiscount: true });
  await panel.getByRole("radio", { name: "Sentetik haftalık paket", exact: true }).press("Space");
  await expect(
    panel.getByRole("radio", { name: "Sentetik haftalık paket", exact: true }),
  ).toBeChecked();
  await panel.getByLabel("Başlangıç", { exact: true }).fill("2026-11-15");
  await panel.getByLabel("Bitiş", { exact: true }).fill("2026-11-22");
  await panel.getByLabel("Satış bedeli (alt birim, isteğe bağlı)", { exact: true }).fill("75000");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    panel.getByText("Bu kişi için satış yetkisi doğrulanamadı.", { exact: true }),
  ).toBeVisible();
  expect(previews).toHaveLength(1);
  expect(writes).toHaveLength(0);
  await expect(panel.getByRole("button", { name: "Uygula", exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Örnek Eğitmen", exact: true })).toBeVisible();
});

async function reservationSetup(
  page: Page,
  options: {
    denied?: boolean;
    failNext?: boolean;
    active?: boolean;
    cancelDenied?: boolean;
    cancelUnknown?: boolean;
    cancelUnread?: boolean;
    cancelStale?: boolean;
  } = {},
) {
  const state = await setup(page, { openSale: false }),
    reads: Record<string, unknown>[] = [];
  let failed = false,
    cancelled = false,
    version = 2,
    unreadFailed = false;
  const cancelWrites: Record<string, unknown>[] = [],
    cancelReceipts: Record<string, unknown>[] = [];
  const reservationId = "019a7b00-0000-7000-8000-000000000083",
    secondId = "019a7b00-0000-7000-8000-000000000084";
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const reject = (code: string) =>
      route.fulfill({ json: { ok: false, error: { code, retryable: false, trace_id: I.role } } });
    if (op === "reservation_list_v1") {
      reads.push(req);
      expect(req.person_id).toBe(I.instructor);
      expect(req.page.limit).toBe(20);
      if (!req.session_id) expect(req.page.sort).toBe("created_at_desc");
      if (options.cancelUnread && cancelled && req.session_id && !unreadFailed) {
        unreadFailed = true;
        return reject("TEMPORARY_FAILURE");
      }
      expect(req).not.toHaveProperty("interval");
      if (options.failNext && req.page.cursor && !failed) {
        failed = true;
        return reject("TEMPORARY_FAILURE");
      }
      return send({
        items: [
          {
            id: req.page.cursor ? secondId : reservationId,
            session_id: I.lesson,
            person_id: I.instructor,
            state:
              req.page.cursor || cancelled ? "cancelled" : options.active ? "active" : "completed",
            mode: "flexible",
            version,
          },
        ],
        next_cursor: req.page.cursor || req.session_id ? null : "native-second",
        as_of: "2026-11-16T10:00:00Z",
      });
    }
    if (op === "management_state_get_v1" && req.operation === "reservation_cancel_v1") {
      if (options.cancelDenied) return reject("FORBIDDEN");
      expect(req.selector.key.reservation_id).toBe(reservationId);
      return send({
        items: [
          {
            operation: "reservation_cancel_v1",
            state: "active",
            as_of: "2026-11-16T10:00:00Z",
            entity: { type: "reservations", id: reservationId },
            exists: true,
            current: {
              operation: "reservation_cancel_v1",
              values: { reservation_id: reservationId },
            },
            versions: [{ entity: { type: "reservations", id: reservationId }, version }],
          },
        ],
        next_cursor: null,
        as_of: "2026-11-16T10:00:00Z",
      });
    }
    if (op === "reservation_cancel_v1") {
      cancelWrites.push(req);
      expect(req.reservation_id).toBe(reservationId);
      expect(req.reason).toBe("Synthetic cancellation reason");
      if (options.cancelStale && cancelWrites.length === 1) {
        version++;
        return reject("VERSION_CONFLICT");
      }
      if (cancelled) {
        const first = cancelWrites[0]!;
        expect({ ...req, request_id: null }).toEqual({ ...first, request_id: null });
      } else {
        expect(req.expected_version).toBe(version);
        cancelled = true;
        version++;
      }
      if (options.cancelUnknown && cancelWrites.length === 1) return route.abort("failed");
      return send({ primary_id: reservationId, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1" && req.operation === "reservation_cancel_v1") {
      cancelReceipts.push(req);
      return reject("NOT_FOUND");
    }
    if (op === "session_get_v1")
      return send({
        id: I.lesson,
        class_id: null,
        discipline_id: I.discipline,
        format: "group",
        starts_at: "2026-11-16T10:00:00Z",
        ends_at: "2026-11-16T11:00:00Z",
        state: options.active ? "planned" : "occurred",
        attendance_state: options.active ? "open" : "closed",
        assignments: [],
        version: 4,
        capacity: {
          total: 8,
          held: 0,
          remaining: 8,
          category_held: null,
          category_remaining: null,
          room_capacity: null,
        },
      });
    if (op === "attendance_get_v1") {
      if (options.denied) return reject("FORBIDDEN");
      return send({
        session_id: I.lesson,
        session_version: 4,
        closure_state: options.active ? "open" : "closed",
        revision: 1,
        entries: [
          {
            reservation_id: reservationId,
            person_id: I.instructor,
            result: "attended",
            version: 1,
            protected: false,
            eligibility_snapshot: null,
          },
          {
            reservation_id: reservationId,
            person_id: I.role,
            result: "no_show",
            version: 1,
            protected: false,
            eligibility_snapshot: null,
          },
        ],
      });
    }
    return route.fallback();
  });
  await page.getByRole("tab", { name: "Rezervasyon ve yoklama", exact: true }).click();
  return {
    ...state,
    reads,
    cancelWrites,
    cancelReceipts,
    grid: page.getByRole("grid", { name: "Rezervasyon ve yoklama geçmişi", exact: true }),
  };
}
test("mobile member reservations preserve native cursor pages, current member attendance and keyboard scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const { grid, reads, writes } = await reservationSetup(page);
  await expect(grid.getByText("Tango · Grup dersi", { exact: true })).toBeVisible();
  await expect(grid.getByText("Geldi", { exact: true })).toBeVisible();
  await expect(grid.getByText("Gelmedi", { exact: true })).toHaveCount(0);
  await expect(grid.getByText(/13:00/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Yaklaşan", exact: true })).toBeEnabled();
  await expect(page.getByRole("radio", { name: "Geçmiş", exact: true })).toBeEnabled();
  const region = page.getByRole("region", { name: "Rezervasyon ve yoklama geçmişi", exact: true });
  await region.focus();
  await expect(region).toBeFocused();
  await page.keyboard.press("ArrowRight");
  expect((await scanAccessibility(page, "member-reservation-first-page")).violations).toEqual([]);
  await page.getByRole("button", { name: "Sonraki rezervasyonlar", exact: true }).click();
  await expect(grid.getByText("İptal", { exact: true })).toBeVisible();
  await expect(grid.getByText("Tamamlandı", { exact: true })).toHaveCount(0);
  await expect(grid.getByText("Yoklama kaydı yok", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sonraki rezervasyonlar", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Önceki rezervasyonlar", exact: true }).click();
  await expect(grid.getByText("Tamamlandı", { exact: true })).toBeVisible();
  expect(reads.some((r) => (r.page as { cursor?: string }).cursor === "native-second")).toBe(true);
  expect(writes).toHaveLength(0);
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
});
test("native reservation time filters discard the previous cursor chain and reread each server partition", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const { grid, reads, cancelWrites } = await reservationSetup(page);
  await expect(grid.getByText("Tamamlandı", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sonraki rezervasyonlar", exact: true }).click();
  await expect(grid.getByText("İptal", { exact: true })).toBeVisible();
  const filtered: Record<string, unknown>[] = [];
  const futureSession = "019a7b00-0000-7000-8000-000000000095";
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "reservation_list_v1") {
      filtered.push(req);
      expect(req).not.toHaveProperty("interval");
      if (req.time_filter === "upcoming")
        return send({
          items: [
            {
              id: "019a7b00-0000-7000-8000-000000000096",
              session_id: futureSession,
              person_id: I.instructor,
              state: "active",
              mode: "flexible",
              version: 2,
            },
          ],
          next_cursor: req.page.cursor ? null : "future-second",
          as_of: "2026-11-16T10:00:00Z",
        });
      if (req.time_filter === "past")
        return send({ items: [], next_cursor: null, as_of: "2026-11-16T10:00:00Z" });
      return route.fallback();
    }
    if (op === "session_get_v1" && req.session_id === futureSession)
      return send({
        id: futureSession,
        class_id: null,
        discipline_id: I.discipline,
        format: "group",
        starts_at: "2099-11-16T10:00:00Z",
        ends_at: "2099-11-16T11:00:00Z",
        state: "planned",
        attendance_state: "open",
        assignments: [],
        version: 4,
        capacity: {
          total: 8,
          held: 1,
          remaining: 7,
          category_held: null,
          category_remaining: null,
          room_capacity: null,
        },
      });
    if (op === "attendance_get_v1" && req.session_id === futureSession)
      return send({
        session_id: futureSession,
        session_version: 4,
        closure_state: "open",
        revision: 0,
        entries: [],
      });
    return route.fallback();
  });
  await page.getByRole("radio", { name: "Yaklaşan", exact: true }).press("Space");
  await expect(grid.getByText("Kesin", { exact: true })).toBeVisible();
  expect(filtered[0]).toMatchObject({ time_filter: "upcoming", page: { limit: 20 } });
  expect(filtered[0]!.page).not.toHaveProperty("cursor");
  await page.getByRole("button", { name: "Sonraki rezervasyonlar", exact: true }).click();
  await expect
    .poll(() =>
      filtered.some((req) => (req.page as { cursor?: string }).cursor === "future-second"),
    )
    .toBe(true);
  await page.getByRole("radio", { name: "Geçmiş", exact: true }).press("Space");
  await expect(grid.getByText("Kesin", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Önceki rezervasyonlar", exact: true }),
  ).toBeDisabled();
  const past = filtered.find((req) => req.time_filter === "past");
  expect(past).toBeDefined();
  expect(past!.page).not.toHaveProperty("cursor");
  await page.getByRole("radio", { name: "Tümü", exact: true }).press("Space");
  await expect(grid.getByText("Tamamlandı", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Önceki rezervasyonlar", exact: true }),
  ).toBeDisabled();
  expect(filtered.at(-1)).toMatchObject({ time_filter: "all" });
  expect(filtered.at(-1)!.page).not.toHaveProperty("cursor");
  expect(reads.some((req) => (req.page as { cursor?: string }).cursor === "native-second")).toBe(
    true,
  );
  expect(cancelWrites).toHaveLength(0);
  expect((await scanAccessibility(page, "member-native-time-filters")).violations).toEqual([]);
});
test("denied attendance stays unknown while authorized reservation and lesson remain visible", async ({
  page,
}) => {
  const options = { denied: true };
  const { grid, writes } = await reservationSetup(page, options);
  await expect(grid.getByText("Tango · Grup dersi", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Bazı ders veya yoklama bilgileri alınamadı. Bilinmeyen bilgi — ile gösterilir.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(grid.getByText("Geldi", { exact: true })).toHaveCount(0);
  await expect(grid.getByText("Yoklama kaydı yok", { exact: true })).toHaveCount(0);
  options.denied = false;
  await page.getByRole("button", { name: "Rezervasyonları yeniden oku", exact: true }).click();
  await expect(grid.getByText("Geldi", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Bazı ders veya yoklama bilgileri alınamadı. Bilinmeyen bilgi — ile gösterilir.",
      { exact: true },
    ),
  ).toHaveCount(0);
  expect(writes).toHaveLength(0);
});
test("reservation page read errors do not relabel stale rows as the next page and can retry", async ({
  page,
}) => {
  const { grid, writes } = await reservationSetup(page, { failNext: true });
  await expect(grid.getByText("Tamamlandı", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sonraki rezervasyonlar", exact: true }).click();
  await expect(
    page.getByText("Rezervasyonlar alınamadı. Yeniden dene.", { exact: true }),
  ).toBeVisible();
  await expect(grid.getByText("Tamamlandı", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Rezervasyonları yeniden oku", exact: true }).click();
  await expect(grid.getByText("İptal", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
});

async function openCancellation(page: Page, options: Parameters<typeof reservationSetup>[1] = {}) {
  const state = await reservationSetup(page, { ...options, active: true });
  const opener = state.grid.getByRole("button", { name: /^İptal et/ });
  await opener.click();
  const dialog = page.getByRole("alertdialog", { name: "Rezervasyonu iptal et", exact: true });
  await expect(dialog).toBeVisible();
  return { ...state, dialog, opener };
}
test("reservation cancellation validates reason, uses the native version and rereads the cancelled row", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 600 });
  const { dialog, grid, cancelWrites } = await openCancellation(page);
  const confirm = dialog.getByRole("button", { name: "İptal et", exact: true });
  await expect(confirm).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
  await confirm.click();
  await expect(dialog.getByLabel("Gerekçe", { exact: true })).toBeFocused();
  await expect(dialog.getByLabel("Gerekçe", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(cancelWrites).toHaveLength(0);
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Synthetic cancellation reason");
  expect((await scanAccessibility(page, "cancel-reservation-edit")).violations).toEqual([]);
  await confirm.click();
  await expect(
    dialog.getByText("Rezervasyon iptal edildi; güncel rezervasyon, seans ve haklar okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(cancelWrites).toHaveLength(1);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(grid.getByText("İptal", { exact: true })).toBeVisible();
  await expect(grid.getByRole("button", { name: /^İptal et/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Rezervasyonları yeniden oku", exact: true }),
  ).toBeFocused();
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
});
test("reservation cancellation denies a missing native action grant without losing the readable row", async ({
  page,
}) => {
  const { dialog, opener, cancelWrites } = await openCancellation(page, { cancelDenied: true });
  await expect(
    dialog.getByText("Bu rezervasyon için iptal yetkisi veya güncel kaynak doğrulanamadı.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "İptal et", exact: true })).toBeDisabled();
  expect(cancelWrites).toHaveLength(0);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(opener).toBeFocused();
});
test("reservation cancellation keeps the frozen key after an unknown result and failed receipt read", async ({
  page,
}) => {
  const { dialog, cancelWrites, cancelReceipts } = await openCancellation(page, {
    cancelUnknown: true,
  });
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Synthetic cancellation reason");
  await dialog.getByRole("button", { name: "İptal et", exact: true }).click();
  await expect(
    dialog.getByText("Sonuç henüz doğrulanamadı. Aynı işlemle devam et.", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Gerekçe", { exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toBeEnabled();
  expect(cancelReceipts).toHaveLength(1);
  await dialog.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }).click();
  await expect(
    dialog.getByText("Rezervasyon iptal edildi; güncel rezervasyon, seans ve haklar okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(cancelWrites).toHaveLength(2);
  expect(cancelWrites[0]!.operation_key).toBe(cancelWrites[1]!.operation_key);
  expect(cancelWrites[0]!.request_id).not.toBe(cancelWrites[1]!.request_id);
});
test("reservation cancellation recovers an ACK reread failure without writing again", async ({
  page,
}) => {
  const { dialog, cancelWrites } = await openCancellation(page, { cancelUnread: true });
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Synthetic cancellation reason");
  await dialog.getByRole("button", { name: "İptal et", exact: true }).click();
  await expect(
    dialog.getByText("İptal alındı; güncel kayıtlar henüz okunamadı.", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    dialog.getByText("Rezervasyon iptal edildi; güncel rezervasyon, seans ve haklar okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(cancelWrites).toHaveLength(1);
});
test("reservation cancellation needs a fresh source and explicit confirmation after a version conflict", async ({
  page,
}) => {
  const { dialog, cancelWrites } = await openCancellation(page, { cancelStale: true });
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Synthetic cancellation reason");
  await dialog.getByRole("button", { name: "İptal et", exact: true }).click();
  await expect(
    dialog.getByText("Rezervasyon değişti. Güncel kaydı yeniden oku ve tekrar onayla.", {
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "İptal bilgisini yeniden oku", exact: true }).click();
  const confirm = dialog.getByRole("button", { name: "İptal et", exact: true });
  await expect(confirm).toBeEnabled();
  expect(cancelWrites).toHaveLength(1);
  await confirm.click();
  await expect(
    dialog.getByText("Rezervasyon iptal edildi; güncel rezervasyon, seans ve haklar okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(cancelWrites).toHaveLength(2);
  expect(cancelWrites[0]!.operation_key).not.toBe(cancelWrites[1]!.operation_key);
  expect(cancelWrites[1]!.expected_version).toBe(3);
});

async function negativeSetup(
  page: Page,
  options: { disabled?: boolean; unknown?: boolean; unread?: boolean } = {},
) {
  await setup(page, { openSale: false });
  const writes: Record<string, unknown>[] = [],
    previews: Record<string, unknown>[] = [];
  let saved = false,
    unread = false;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "negative_limits_get_v1") {
      expect(req).toMatchObject({
        person_id: I.instructor,
        discipline_id: I.discipline,
        center_id: I.center,
        include_delegation: true,
      });
      if (options.unread && saved && !unread) {
        unread = true;
        return route.abort("failed");
      }
      const row: NegativeLimitsView = {
        person_id: I.instructor,
        center_id: I.center,
        discipline_id: I.discipline,
        version: 1,
        override: saved ? 2 : null,
        default_limit: 0,
        upper_limit: 4,
        effective_limit: saved ? 2 : 0,
        reserved_deficit: 0,
        consumed_deficit: 0,
        policy_version_ids: [],
        override_version: saved ? 1 : null,
        personal_override_enabled: !options.disabled,
      };
      return send(row);
    }
    if (op === "reservation_impact_preview_v1") {
      previews.push(req);
      const result: ReservationProtectionPreview = {
        change: req.change,
        preview: {
          id: previewId,
          token: "synthetic-limit-capability",
          scope_hash: "synthetic",
          dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
          effects: [],
          blockers: [],
          expires_at: "2099-01-01T00:00:00Z",
        },
        affected: [],
        preserves_reservations: true,
        waives_independent_blocks: false,
      };
      return send(result);
    }
    if (op === "negative_limit_set_v1") {
      writes.push(req);
      saved = true;
      expect(req).toMatchObject({
        person_id: I.instructor,
        discipline_id: I.discipline,
        allowed_negative_credits: 2,
        expected_version: 1,
        accepted_reservation_ids: [],
        impact_approval: { id: previewId, token: "synthetic-limit-capability" },
      });
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({ primary_id: debtId, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1")
      return route.fulfill({
        json: { ok: false, error: { code: "NOT_FOUND", retryable: false, trace_id: I.role } },
      });
    if (op === "reservation_impact_apply_v1") throw new Error("ALTERNATIVE_WRITER_MUST_NOT_RUN");
    return route.fallback();
  });
  await page.getByLabel("Disiplin", { exact: true }).selectOption(I.discipline);
  const section = page
    .getByRole("heading", { name: "Negatif limit", exact: true })
    .locator("..")
    .locator("..");
  const edit = section.getByRole("button", { name: "Düzenle", exact: true });
  if (!options.disabled) await expect(edit).toBeEnabled();
  return {
    writes,
    previews,
    edit,
    section,
    panel: page.getByRole("dialog", { name: "Negatif limit", exact: true }),
  };
}
async function reviewNegative(page: Page, options: Parameters<typeof negativeSetup>[1] = {}) {
  const state = await negativeSetup(page, options);
  await state.edit.click();
  await state.panel.getByLabel("Limit (ders, 0 kapalı)", { exact: true }).fill("2");
  await state.panel.getByLabel("Gerekçe", { exact: true }).fill("Synthetic personal limit reason");
  await state.panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    state.panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }),
  ).toBeVisible();
  return state;
}
test("negative limit preserves native zero, validates fields, reviews effects and saves only after explicit approval", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const { edit, panel, writes, previews } = await negativeSetup(page);
  await edit.click();
  await expect(panel.getByLabel("Limit (ders, 0 kapalı)", { exact: true })).toHaveValue("0");
  await panel.getByLabel("Limit (ders, 0 kapalı)", { exact: true }).fill("1.5");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByLabel("Limit (ders, 0 kapalı)", { exact: true })).toBeFocused();
  expect(previews).toHaveLength(0);
  await panel.getByLabel("Limit (ders, 0 kapalı)", { exact: true }).fill("2");
  await panel.getByLabel("Gerekçe", { exact: true }).fill("Synthetic personal limit reason");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Etki", exact: true })).toBeFocused();
  const confirm = panel.getByRole("button", { name: "Uygula", exact: true });
  await expect(confirm).toBeDisabled();
  expect(writes).toHaveLength(0);
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await confirm.click();
  await expect(
    panel.getByText(
      "Negatif limit kaydedildi; güncel limit, haklar ve etkilenen rezervasyonlar okundu.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  await expect(confirm).toBeDisabled();
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
});
test("negative limit does not bypass a disabled organization delegation", async ({ page }) => {
  const { section, edit, writes, previews } = await negativeSetup(page, { disabled: true });
  await expect(edit).toBeDisabled();
  await expect(
    section.getByText(
      "Organizasyon kişisel negatif limit değişikliğine izin vermiyor. Mevcut politika geçerlidir.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(writes).toHaveLength(0);
  expect(previews).toHaveLength(0);
});
for (const mode of ["unknown", "unread"] as const)
  test(`negative limit ${mode} result recovers without changing the reviewed intent`, async ({
    page,
  }) => {
    const { panel, writes } = await reviewNegative(page, { [mode]: true });
    await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
    await panel.getByRole("button", { name: "Uygula", exact: true }).click();
    await expect(
      panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeVisible();
    if (mode === "unknown") {
      await panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
      await panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }).click();
    } else
      await panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
    await expect(
      panel.getByText(
        "Negatif limit kaydedildi; güncel limit, haklar ve etkilenen rezervasyonlar okundu.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(writes).toHaveLength(mode === "unknown" ? 2 : 1);
    if (mode === "unknown") {
      expect({ ...writes[0], request_id: null }).toEqual({ ...writes[1], request_id: null });
      expect(writes[0]!.request_id).not.toBe(writes[1]!.request_id);
    }
  });

async function rightSetup(
  page: Page,
  options: {
    action?: "adjust" | "extend";
    unknown?: boolean;
    unread?: boolean;
    stale?: boolean;
  } = {},
) {
  await setup(page, { openSale: false, existingRights: true });
  const writes: Record<string, unknown>[] = [],
    previews: Record<string, unknown>[] = [];
  const row: EntitlementView = {
    sale_id: saleId,
    account_id: debtId,
    person_id: I.instructor,
    product_version_id: versionId,
    start_date: "2026-11-15",
    end_date: "2026-11-22",
    timezone: "Europe/Istanbul",
    state: "active",
    kind: "credits",
    booking_mode: "flexible",
    version: 1,
    sale_version: 1,
    sale_state: "active",
    available: 8,
    reserved: 0,
    consumed: 0,
    deficit: 0,
    quotas: [],
    deficit_scopes: [],
  };
  let saved = false,
    unread = false;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "entitlements_get_v1") {
      if (options.unread && saved && !unread) {
        unread = true;
        return route.abort("failed");
      }
      return send([row]);
    }
    if (op === "reservation_impact_preview_v1") {
      previews.push(req);
      expect(req.change.sale_id).toBe(saleId);
      const result: ReservationProtectionPreview = {
        change: req.change,
        preview: {
          id: previews.length === 1 ? previewId : secondPreviewId,
          token: `synthetic-right-capability-${previews.length}`,
          scope_hash: "synthetic",
          dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
          effects: [
            {
              entity: {
                type: req.change.kind === "credit_adjust" ? "entitlement_accounts" : "sales",
                id: req.change.kind === "credit_adjust" ? debtId : saleId,
              },
              action: "adjust",
            },
          ],
          blockers: [],
          expires_at: "2099-01-01T00:00:00Z",
        },
        affected: [],
        preserves_reservations: true,
        waives_independent_blocks: false,
      };
      return send(result);
    }
    if (op === "credit_adjust_v1" || op === "entitlement_extend_v1") {
      writes.push(req);
      expect(req.sale_id).toBe(saleId);
      expect(req.accepted_reservation_ids).toEqual([]);
      if (options.stale && writes.length === 1) {
        row.version = 2;
        return route.fulfill({
          json: {
            ok: false,
            error: { code: "VERSION_CONFLICT", retryable: false, trace_id: I.role },
          },
        });
      }
      if (!saved) {
        row.version!++;
        if (op === "credit_adjust_v1") row.available = 10;
        else {
          row.end_date = req.end_date;
          row.sale_version!++;
        }
        saved = true;
      }
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({ primary_id: debtId, changed: [], jobs: [] });
    }
    if (op === "reservation_impact_apply_v1")
      throw new Error("ALTERNATIVE_IMPACT_WRITER_MUST_NOT_RUN");
    if (op === "operation_status_get_v1")
      return route.fulfill({
        json: { ok: false, error: { code: "NOT_FOUND", retryable: false, trace_id: I.role } },
      });
    return route.fallback();
  });
  const action = options.action ?? "adjust",
    label = action === "adjust" ? "Hakkı düzelt" : "Süreyi uzat";
  await page.getByRole("button", { name: label, exact: true }).click();
  const panel = page.getByRole("dialog", { name: label, exact: true });
  await expect(panel).toBeVisible();
  return { panel, writes, previews, row };
}
async function rightReview(page: Page, options: Parameters<typeof rightSetup>[1] = {}) {
  const state = await rightSetup(page, options),
    { panel } = state;
  if (options.action === "extend")
    await panel.getByLabel("Bitiş", { exact: true }).fill("2026-11-25");
  else await panel.getByLabel("Ders sayısı", { exact: true }).fill("2");
  await panel.getByLabel("Gerekçe", { exact: true }).fill("Synthetic right adjustment reason");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Etki", exact: true })).toBeFocused();
  return state;
}
test("right adjustment rejects zero, reviews the native source and updates rights after explicit approval", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const { panel, writes, previews } = await rightSetup(page);
  await panel.getByLabel("Ders sayısı", { exact: true }).fill("0");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByLabel("Ders sayısı", { exact: true })).toBeFocused();
  expect(previews).toHaveLength(0);
  await panel.getByLabel("Ders sayısı", { exact: true }).fill("2");
  await panel.getByLabel("Gerekçe", { exact: true }).fill("Synthetic right adjustment reason");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  const confirm = panel.getByRole("button", { name: "Uygula", exact: true });
  await expect(confirm).toBeDisabled();
  expect(writes).toHaveLength(0);
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await confirm.click();
  await expect(
    panel.getByText("Hak işlemi kaydedildi; güncel haklar ve etkilenen rezervasyonlar okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    quantity: 2,
    direction: "increase",
    impact_approval: { id: previewId, token: "synthetic-right-capability-1" },
  });
  expect(writes[0]).not.toHaveProperty("expected_version");
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
});
test("right extension rejects the existing date and binds the new date to the native account version", async ({
  page,
}) => {
  const { panel, writes, previews } = await rightSetup(page, { action: "extend" });
  await panel.getByLabel("Gerekçe", { exact: true }).fill("Synthetic extension reason");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByLabel("Bitiş", { exact: true })).toBeFocused();
  expect(previews).toHaveLength(0);
  await panel.getByLabel("Bitiş", { exact: true }).fill("2026-11-25");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "Uygula", exact: true }).click();
  await expect(
    panel.getByText("Hak işlemi kaydedildi; güncel haklar ve etkilenen rezervasyonlar okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ end_date: "2026-11-25", expected_version: 1 });
  expect(writes[0]).not.toHaveProperty("quantity");
});
for (const mode of ["unknown", "unread"] as const)
  test(`right adjustment ${mode} result retains its reviewed intent and never repeats an acknowledged writer`, async ({
    page,
  }) => {
    const { panel, writes } = await rightReview(page, {
      action: mode === "unread" ? "extend" : "adjust",
      [mode]: true,
    });
    await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
    await panel.getByRole("button", { name: "Uygula", exact: true }).click();
    await expect(
      panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
    if (mode === "unknown")
      await panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }).click();
    await expect(
      panel.getByText("Hak işlemi kaydedildi; güncel haklar ve etkilenen rezervasyonlar okundu.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(writes).toHaveLength(mode === "unknown" ? 2 : 1);
    if (mode === "unknown") {
      expect({ ...writes[0], request_id: null }).toEqual({ ...writes[1], request_id: null });
      expect(writes[0]!.request_id).not.toBe(writes[1]!.request_id);
    }
  });
test("right extension conflict requires a fresh native version, preview and explicit confirmation", async ({
  page,
}) => {
  const { panel, writes, previews } = await rightReview(page, { action: "extend", stale: true });
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "Uygula", exact: true }).click();
  await expect(
    panel.getByText(
      "Hak veya önizleme değişti. Geri dönüp güncel kaynağı yeniden incele ve onayla.",
      { exact: true },
    ),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Geri", exact: true }).click();
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }),
  ).not.toBeChecked();
  expect(writes).toHaveLength(1);
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "Uygula", exact: true }).click();
  await expect(
    panel.getByText("Hak işlemi kaydedildi; güncel haklar ve etkilenen rezervasyonlar okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(previews).toHaveLength(2);
  expect(writes).toHaveLength(2);
  expect(writes[1]!.expected_version).toBe(2);
  expect(writes[0]!.operation_key).not.toBe(writes[1]!.operation_key);
});

const freezeRecordId = "019a7b00-0000-7000-8000-000000000091",
  freezeSessionId = "019a7b00-0000-7000-8000-000000000092",
  freezeReservationId = "019a7b00-0000-7000-8000-000000000093";
function profileFreezeRecord(mode: "active" | "scheduled"): TableFreezes {
  return {
    id: freezeRecordId,
    org_id: I.org,
    sale_id: saleId,
    version: 1,
    created_at: "2026-11-14T10:00:00Z",
    starts_at: mode === "active" ? "2026-11-14T21:00:00Z" : "2026-11-17T21:00:00Z",
    planned_end: "2026-11-20T21:00:00Z",
    state: "scheduled",
    preview_id: secondPreviewId,
  };
}
async function freezeSetup(
  page: Page,
  options: {
    existing?: "active" | "scheduled";
    binding?: boolean;
    unknown?: boolean;
    unread?: boolean;
    stale?: boolean;
  } = {},
) {
  await page.clock.install({ time: new Date("2026-11-16T08:00:00Z") });
  await setup(page, {
    openSale: false,
    existingRights: true,
    freezeEnabled: true,
    existingFreeze: options.existing,
    freezeBinding: options.binding,
  });
  const writes: Record<string, unknown>[] = [],
    previews: Record<string, unknown>[] = [];
  const row: EntitlementView = {
    sale_id: saleId,
    account_id: debtId,
    person_id: I.instructor,
    product_version_id: versionId,
    start_date: "2026-11-15",
    end_date: "2026-11-22",
    timezone: "Europe/Istanbul",
    state: "active",
    kind: "credits",
    booking_mode: "flexible",
    version: 1,
    sale_version: 1,
    sale_state: "active",
    available: options.binding ? 7 : 8,
    reserved: options.binding ? 1 : 0,
    consumed: 0,
    deficit: 0,
    quotas: [],
    deficit_scopes: [],
    freezes: options.existing ? [profileFreezeRecord(options.existing)] : [],
  };
  let saved = false,
    unread = false;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "entitlements_get_v1") {
      if (options.unread && saved && !unread) {
        unread = true;
        return route.abort("failed");
      }
      return send([row]);
    }
    if (op === "freeze_preview_v1" || op === "freeze_end_preview_v1") {
      previews.push(req);
      if (op === "freeze_preview_v1")
        expect(req).toMatchObject({
          sale_id: saleId,
          dates: { start_date: "2026-11-18", end_date: "2026-11-20" },
        });
      else expect(req).toMatchObject({ freeze_id: freezeRecordId, end_date: "2026-11-20" });
      return send({
        id: previews.length === 1 ? previewId : secondPreviewId,
        token: `synthetic-freeze-${previews.length}`,
        scope_hash: "synthetic",
        dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
        effects: [
          {
            entity: {
              type: op === "freeze_preview_v1" ? "sales" : "freezes",
              id: op === "freeze_preview_v1" ? saleId : freezeRecordId,
            },
            action: "adjust",
            ...(op === "freeze_preview_v1" ? { quantity: 2 } : {}),
          },
          ...(options.binding
            ? [{ entity: { type: "reservations", id: freezeReservationId }, action: "adjust" }]
            : []),
        ],
        blockers: [],
        expires_at: "2099-01-01T00:00:00Z",
      });
    }
    if (op === "management_state_get_v1" && req.operation === "reservation_cancel_v1")
      return send({
        items: [
          {
            operation: req.operation,
            exists: true,
            state: "active",
            as_of: "2026-11-16T08:00:00Z",
            entity: { type: "reservations", id: freezeReservationId },
            current: { operation: req.operation, values: { reservation_id: freezeReservationId } },
            versions: [
              { entity: { type: "reservations", id: freezeReservationId }, version: saved ? 4 : 3 },
            ],
          },
        ],
        next_cursor: null,
        as_of: "2026-11-16T08:00:00Z",
      });
    if (op === "reservation_list_v1")
      return send({
        items: options.binding
          ? [
              {
                id: freezeReservationId,
                person_id: I.instructor,
                session_id: freezeSessionId,
                state: "active",
                mode: "flexible",
                version: saved ? 4 : 3,
              },
            ]
          : [],
        next_cursor: null,
        as_of: "2026-11-16T08:00:00Z",
      });
    if (op === "session_get_v1")
      return send({
        id: freezeSessionId,
        discipline_id: I.discipline,
        format: "group",
        starts_at: "2026-11-18T10:00:00Z",
        ends_at: "2026-11-18T11:00:00Z",
        state: "planned",
        attendance_state: "open",
        version: 1,
        assignments: [],
        class_id: null,
        capacity: {
          total: 8,
          held: 1,
          remaining: 7,
          category_held: null,
          category_remaining: null,
          room_capacity: null,
        },
      });
    if (op === "freeze_apply_v1" || op === "freeze_end_apply_v1") {
      writes.push(req);
      expect(req).not.toHaveProperty("dates");
      expect(req).not.toHaveProperty("expected_version");
      if (options.stale && writes.length === 1) {
        row.version = 2;
        return route.fulfill({
          json: { ok: false, error: { code: "PREVIEW_STALE", retryable: false, trace_id: I.role } },
        });
      }
      if (!saved) {
        row.version!++;
        row.sale_version!++;
        if (op === "freeze_apply_v1") {
          row.freezes = [
            {
              ...profileFreezeRecord("scheduled"),
              planned_end: "2026-11-19T21:00:00Z",
              preview_id: previews.length === 1 ? previewId : secondPreviewId,
            },
          ];
          row.end_date = "2026-11-24";
        } else
          row.freezes = [
            { ...row.freezes![0]!, version: 2, state: "ended", actual_end: "2026-11-19T21:00:00Z" },
          ];
        saved = true;
      }
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({ primary_id: freezeRecordId, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1")
      return route.fulfill({
        json: { ok: false, error: { code: "NOT_FOUND", retryable: false, trace_id: I.role } },
      });
    return route.fallback();
  });
  return { writes, previews, panel: page.getByRole("dialog"), row };
}
async function freezeReview(page: Page, options: Parameters<typeof freezeSetup>[1] = {}) {
  const state = await freezeSetup(page, options);
  await page
    .getByRole("button", { name: options.existing ? "Dondurmayı bitir" : "Dondur", exact: true })
    .click();
  if (!options.existing)
    await state.panel.getByLabel("Başlangıç", { exact: true }).fill("2026-11-18");
  await state.panel.getByLabel("Bitiş", { exact: true }).fill("2026-11-20");
  await state.panel.getByLabel("Gerekçe", { exact: true }).fill("Synthetic freeze reason");
  await state.panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(state.panel.getByRole("heading", { name: "Etki", exact: true })).toBeFocused();
  return state;
}
test("freeze review validates dates and preserves native reserved rights and timezone periods", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const { panel, writes, previews, row } = await freezeSetup(page, { binding: true });
  await page.getByRole("button", { name: "Dondur", exact: true }).click();
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByLabel("Başlangıç", { exact: true })).toBeFocused();
  expect(previews).toHaveLength(0);
  await panel.getByLabel("Başlangıç", { exact: true }).fill("2026-11-18");
  await panel.getByLabel("Bitiş", { exact: true }).fill("2026-11-20");
  await panel.getByLabel("Gerekçe", { exact: true }).fill("Synthetic freeze reason");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByText("Korunacak rezervasyonlar", { exact: true })).toBeVisible();
  const confirm = panel.getByRole("button", { name: "Uygula", exact: true });
  await expect(confirm).toBeDisabled();
  expect(writes).toHaveLength(0);
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await confirm.click();
  await expect(
    panel.getByText(
      "Dondurma işlemi kaydedildi; güncel dönem, haklar ve korunan rezervasyonlar okundu.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(row.available).toBe(7);
  expect(row.reserved).toBe(1);
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(
    page.getByText("2026-11-15 – 2026-11-24 · Europe/Istanbul", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Dondurmayı iptal et", exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
});
test("freeze scheduled cancellation opens a separate reason-only sheet without sending a shortening command", async ({
  page,
}) => {
  const { writes, previews } = await freezeSetup(page, { existing: "scheduled" });
  await page.getByRole("button", { name: "Dondurmayı iptal et", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Planlanmış dondurmayı iptal et", exact: true });
  await expect(panel.getByLabel("Gerekçe", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("Başlangıç", { exact: true })).toHaveCount(0);
  await expect(panel.getByLabel("Bitiş", { exact: true })).toHaveCount(0);
  expect(writes).toHaveLength(0);
  expect(previews).toHaveLength(0);
});
test("freeze early end reviews an exact started interval and reads its native end date", async ({
  page,
}) => {
  const { panel, writes, row } = await freezeReview(page, { existing: "active" });
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "Uygula", exact: true }).click();
  await expect(
    panel.getByText(
      "Dondurma işlemi kaydedildi; güncel dönem, haklar ve korunan rezervasyonlar okundu.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(row.freezes![0]!.id).toBe(freezeRecordId);
  expect(row.freezes![0]!.state).toBe("ended");
  expect(row.freezes![0]!.actual_end).toBe("2026-11-19T21:00:00Z");
});
for (const mode of ["unknown", "unread"] as const)
  test(`freeze ${mode} result keeps the frozen key and does not replay an acknowledged command`, async ({
    page,
  }) => {
    const { panel, writes } = await freezeReview(page, {
      ...(mode === "unread" ? { existing: "active" as const } : {}),
      [mode]: true,
    });
    await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
    await panel.getByRole("button", { name: "Uygula", exact: true }).click();
    await expect(
      panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
    if (mode === "unknown")
      await panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }).click();
    await expect(
      panel.getByText(
        "Dondurma işlemi kaydedildi; güncel dönem, haklar ve korunan rezervasyonlar okundu.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(panel).toBeInViewport();
    expect((await scanAccessibility(page, `freeze-${mode}-recovered-panel`)).violations).toEqual(
      [],
    );
    await panel.getByRole("button", { name: "Kapat", exact: true }).click();
    await expect(panel).toHaveCount(0);
    expect(writes).toHaveLength(mode === "unknown" ? 2 : 1);
    if (mode === "unknown") {
      expect({ ...writes[0], request_id: null }).toEqual({ ...writes[1], request_id: null });
      expect(writes[0]!.request_id).not.toBe(writes[1]!.request_id);
    }
  });
test("freeze stale review requires another native preview and explicit approval", async ({
  page,
}) => {
  const { panel, writes, previews } = await freezeReview(page, { stale: true });
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "Uygula", exact: true }).click();
  await expect(
    panel.getByText(
      "Dondurma kaynağı veya önizlemesi değişti. Geri dönüp yeniden incele ve onayla.",
      { exact: true },
    ),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Geri", exact: true }).click();
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }),
  ).not.toBeChecked();
  expect(writes).toHaveLength(1);
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "Uygula", exact: true }).click();
  await expect(
    panel.getByText(
      "Dondurma işlemi kaydedildi; güncel dönem, haklar ve korunan rezervasyonlar okundu.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(previews).toHaveLength(2);
  expect(writes[0]!.operation_key).not.toBe(writes[1]!.operation_key);
});
