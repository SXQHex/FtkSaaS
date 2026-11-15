import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type {
  ProductView,
  SalePreview,
  EntitlementView,
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
      freeze: { enabled: false, extends_validity: false },
      refund: { method: options.timed ? "time_ratio" : "credit_ratio" },
      quota: options.timed ? { period: "week", limit: 2 } : null,
      scopes: [
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
        available: options.timed ? 0 : 8,
        reserved: 0,
        consumed: 0,
        deficit: 0,
        quotas: [],
        deficit_scopes: [],
        kind: p.terms.kind,
        booking_mode: "flexible",
        version: 1,
        sale_version: 1,
      };
      return send(saved ? [row] : []);
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
                remaining_minor: "100000",
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
      expect(req).toMatchObject({
        person_id: I.instructor,
        product_version_id: versionId,
        start_date: "2026-11-15",
        end_date: "2026-11-22",
      });
      expect(req).not.toHaveProperty("payment");
      expect(req).not.toHaveProperty("net_minor");
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
          debt_minor: "100000",
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
  await page.getByRole("button", { name: "Paket / hak tahsis et", exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(panel).toHaveAccessibleName("Paket / hak tahsis et");
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
