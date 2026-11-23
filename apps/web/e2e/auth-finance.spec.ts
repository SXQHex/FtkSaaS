import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type { CashSummary, FinanceView, MemberPageSummary } from "@ftksaas/api-contracts";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { clickWorkspaceLink, origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
const cashId = "019a7b00-0000-7000-8000-000000000061",
  debtId = "019a7b00-0000-7000-8000-000000000062",
  correctionId = "019a7b00-0000-7000-8000-000000000063",
  previewId = "019a7b00-0000-7000-8000-000000000064";
async function setup(
  page: Page,
  options: {
    unknown?: boolean;
    allowed?: boolean;
    withCollection?: boolean;
    correctionUnknown?: boolean;
    openProfileFirst?: boolean;
    stale?: boolean;
    blocked?: boolean;
    directoryReadback?: () => Promise<void>;
  } = {},
) {
  const studio = await mockStudio(page),
    writes: Record<string, unknown>[] = [],
    reads: Record<string, unknown>[] = [];
  let movement: CashSummary | undefined = options.withCollection
    ? {
        id: cashId,
        kind: "collection",
        amount_minor: "40000",
        currency: "TRY",
        occurred_at: "2026-11-15T11:30:00Z",
        center_id: I.center,
        version: 1,
        previous_id: null,
        payment: { method: "cash" },
      }
    : undefined;
  let correction: CashSummary | undefined, prepared: Record<string, unknown> | undefined;
  const directoryReads: Record<string, unknown>[] = [];
  const corrections: Record<string, unknown>[] = [],
    previews: Record<string, unknown>[] = [];
  const remainingDebt = () =>
    String(100000n - BigInt(movement?.amount_minor ?? 0) + BigInt(correction?.amount_minor ?? 0));
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON(),
      send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "finance_directory_get_v1") {
      if (!options.directoryReadback)
        return route.fulfill({
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
      directoryReads.push(req);
      if (movement) await options.directoryReadback();
      return send({
        view: req.view,
        items: [],
        next_cursor: null,
        as_of: new Date().toISOString(),
        totals: [
          {
            currency: "TRY",
            sales_minor: "0",
            collections_minor: movement?.amount_minor ?? "0",
            refunds_minor: "0",
            debt_minor: remainingDebt(),
            credit_minor: "0",
            debt_people: 1,
            credit_people: 0,
          },
        ],
      });
    }
    if (op === "person_get_v1" && options.openProfileFirst) {
      expect(req).toMatchObject({ org_id: I.org, center_id: I.center, person_id: I.instructor });
      return send({
        ...studio.people.find((person) => person.id === I.instructor),
        member_summary: {
          as_of: new Date().toISOString(),
          rights: { status: "restricted" },
          next_lesson: { status: "restricted" },
          debt: {
            status: "available",
            by_currency: [{ currency: "TRY", remaining_minor: remainingDebt() }],
          },
        } satisfies MemberPageSummary,
      });
    }
    if (op === "finance_get_v1") {
      reads.push(req);
      expect(req.person_id).toBe(I.instructor);
      expect(req.currency).toBe("TRY");
      const data: FinanceView = {
        person_id: I.instructor,
        currency: "TRY",
        credit_available_minor: "0",
        debts: [
          {
            id: debtId,
            due_at: "2026-11-15T00:00:00Z",
            remaining_minor: remainingDebt(),
            center_id: I.center,
            version: movement ? 2 : 1,
          },
        ],
        movements: {
          items: movement ? [movement, ...(correction ? [correction] : [])] : [],
          next_cursor: null,
          as_of: new Date().toISOString(),
        },
      };
      return send(data);
    }
    if (op === "management_state_get_v1" && req.operation === "collection_record_v1") {
      expect(req.selector).toEqual({
        operation: "collection_record_v1",
        key: { person_id: I.instructor },
      });
      if (options.allowed === false)
        return route.fulfill({
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
      return send({
        items: [
          {
            operation: "collection_record_v1",
            exists: true,
            entity: { type: "people", id: I.instructor },
            state: "active",
            versions: [],
            current: { operation: "collection_record_v1", values: { person_id: I.instructor } },
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (op === "management_state_get_v1" && req.operation === "collection_correct_preview_v1") {
      expect(req.selector).toEqual({
        operation: "collection_correct_preview_v1",
        key: { cash_movement_id: cashId },
      });
      return send({
        items: [
          {
            operation: req.operation,
            exists: true,
            entity: { type: "cash_movements", id: cashId },
            state: null,
            versions: [{ entity: { type: "cash_movements", id: cashId }, version: 1 }],
            current: { operation: req.operation, values: { cash_movement_id: cashId } },
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (op === "collection_correct_preview_v1") {
      previews.push(req);
      prepared = req.correction;
      expect(req.cash_movement_id).toBe(cashId);
      return send({
        id: previewId,
        token: "synthetic-preview-capability",
        scope_hash: "synthetic",
        dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
        effects: [
          {
            entity: { type: "cash_movements", id: cashId },
            action: "adjust",
            reason: req.reason,
            amount_minor: req.correction.amount_minor,
            currency: req.correction.currency,
          },
          {
            entity: { type: "debts", id: debtId },
            action: "reverse",
            amount_minor: req.correction.amount_minor,
            currency: "TRY",
          },
          {
            entity: { type: "people", id: I.instructor },
            action: "reverse",
            amount_minor: "0",
            currency: "TRY",
          },
        ],
        blockers: options.blocked
          ? [{ code: "INSUFFICIENT_STUDENT_CREDIT", retryable: false, trace_id: I.role }]
          : [],
        expires_at: "2099-01-01T00:00:00Z",
      });
    }
    if (op === "collection_correct_apply_v1") {
      corrections.push(req);
      expect(req.preview).toEqual({ id: previewId, token: "synthetic-preview-capability" });
      if (options.stale)
        return route.fulfill({
          json: { ok: false, error: { code: "PREVIEW_STALE", retryable: false, trace_id: I.role } },
        });
      if (options.correctionUnknown && corrections.length === 1) return route.abort();
      correction = {
        id: correctionId,
        kind: "correction_out",
        amount_minor: String(prepared!.amount_minor),
        currency: "TRY",
        occurred_at: String(prepared!.occurred_at),
        center_id: I.center,
        version: 1,
        previous_id: cashId,
        payment: null,
      };
      return send({ primary_id: correctionId, changed: [], jobs: [] });
    }
    if (op === "collection_record_v1") {
      writes.push(req);
      if (options.unknown && writes.length === 1) return route.abort();
      movement = {
        id: cashId,
        kind: "collection",
        amount_minor: req.amount_minor,
        currency: req.currency,
        occurred_at: req.occurred_at,
        center_id: I.center,
        version: 1,
        previous_id: null,
        payment: req.payment,
      };
      return send({ primary_id: cashId, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1")
      return route.fulfill({
        json: {
          ok: false,
          error: { code: "VALIDATION_FAILED", retryable: false, trace_id: I.role },
        },
      });
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  const centerPath = `${origin}/o/${I.org}/c/${I.center}`;
  if (options.openProfileFirst) {
    await page.goto(`${centerPath}/people/${I.instructor}`);
    await expect(page.getByRole("definition").filter({ hasText: "₺600,00" })).toBeVisible();
    await clickWorkspaceLink(page, "Finans");
  } else {
    await page.goto(`${centerPath}/finance`);
  }
  if (options.directoryReadback)
    await expect(page.getByText("TRY ₺1.000,00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Üye bazlı finans", exact: true }).click();
  await page.getByLabel("Üye", { exact: true }).selectOption(I.instructor);
  await page.getByLabel("Para birimi", { exact: true }).fill("TRY");
  await page.getByRole("button", { name: "Finansı getir", exact: true }).click();
  await expect.poll(() => reads.length).toBeGreaterThan(0);
  await expect(page.getByRole("grid", { name: "Hareketler", exact: true })).toBeVisible();
  return { studio, writes, reads, corrections, previews, directoryReads };
}
async function fillCollection(page: Page) {
  await page.getByRole("button", { name: "Tahsilat al", exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(panel).toHaveAccessibleName("Tahsilat al");
  await panel.getByLabel("Tutar (para biriminin alt birimi)", { exact: true }).fill("40000");
  await panel.getByRole("radio", { name: "Havale", exact: true }).click();
  await panel.getByLabel("İşlem referansı", { exact: true }).fill("SYNTHETIC-REF");
  await panel.getByLabel("İşlem tarihi ve saati", { exact: true }).fill("2026-11-15T14:30");
  return panel;
}

test("mobile collection uses explicit authority, reference and timezone then rereads the remaining debt", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await setup(page);
  const source = { scope: "center", center_id: I.center, key: "bank-try", version: 2 };
  const defaults = { currency: "TRY", payment_method: "bank_transfer" };
  await page.route("**/functions/v1/backend-v1/settings_catalog_get_v1", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      scope: "center",
      org_id: I.org,
      center_id: I.center,
    });
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          scope: "center",
          catalog_version: 24,
          fields: [],
          defaults: {},
          brand_packages: [],
          limitations: [],
          preparation_templates: {
            availability: [],
            packages: [],
            package_currency_suggestion: "TRY",
            collections: [
              { source, template: { key: source.key, name: "TRY havale", defaults } },
              {
                source: { ...source, key: "bank-usd" },
                template: {
                  key: "bank-usd",
                  name: "USD havale",
                  defaults: { ...defaults, currency: "USD" },
                },
              },
            ],
          },
        },
      },
    });
  });
  await page.route("**/functions/v1/backend-v1/settings_preparation_resolve_v1", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      org_id: I.org,
      center_id: I.center,
      kind: "collection",
      source,
    });
    return route.fulfill({
      json: { ok: true, trace_id: I.role, data: { kind: "collection", source, defaults } },
    });
  });
  await expect(page.getByRole("button", { name: "Tahsilat al", exact: true })).toBeEnabled();
  expect((await scanAccessibility(page, "finance-person-scope")).violations).toEqual([]);
  await page.getByRole("button", { name: "Tahsilat al", exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(panel).toHaveAccessibleName("Tahsilat al");
  const template = panel.getByRole("combobox", { name: "Hazırlık şablonu" });
  await template.selectOption({ label: "TRY havale · Merkez" });
  await expect(template.locator("option").filter({ hasText: "USD havale" })).toHaveCount(0);
  await panel.getByRole("button", { name: "Taslağa uygula", exact: true }).click();
  await expect(panel.getByRole("radio", { name: "Havale", exact: true })).toBeChecked();
  const reference = panel.getByLabel("İşlem referansı", { exact: true });
  await expect(reference).toHaveValue("");
  await expect(reference).toHaveJSProperty("required", true);
  await reference.fill("SYNTHETIC-REF");
  await panel.getByLabel("İşlem tarihi ve saati", { exact: true }).fill("2026-11-15T14:30");
  const amount = panel.getByLabel("Tutar (para biriminin alt birimi)", { exact: true });
  await amount.fill("0");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(amount).toHaveAttribute("aria-invalid", "true");
  await expect(amount).toBeFocused();
  await expect(
    panel.getByText("Pozitif bir tam alt birim tutarı gir.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await amount.fill("40000");
  await expect(amount).toHaveAttribute("aria-invalid", "false");
  await reference.clear();
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(reference).toBeFocused();
  await expect(panel.getByRole("button", { name: "Tahsilatı kaydet", exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  await reference.fill("SYNTHETIC-REF");
  expect((await scanAccessibility(page, "collection-editor")).violations).toEqual([]);
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Tahsilatı kaydet", exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await expect(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true })).toBeChecked();
  expect((await scanAccessibility(page, "collection-review")).violations).toEqual([]);
  await panel.getByRole("button", { name: "Tahsilatı kaydet", exact: true }).click();
  await expect(
    panel.getByText("Tahsilat ve güncel finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    person_id: I.instructor,
    currency: "TRY",
    amount_minor: "40000",
    occurred_at: "2026-11-15T11:30:00Z",
    payment: { method: "bank_transfer", reference: "SYNTHETIC-REF" },
  });
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.getByRole("tab", { name: /Açık borçlar/ }).click();
  await expect(
    page
      .getByRole("grid", { name: "Açık borçlar", exact: true })
      .getByText("₺600,00", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
});
test("finance read does not enable collection when native writer authority is denied", async ({
  page,
}) => {
  const state = await setup(page, { allowed: false });
  await expect(
    page.getByText("Bu kişi için tahsilat yetkisi doğrulanamadı.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tahsilat al", exact: true })).toBeDisabled();
  await expect(page.getByRole("radio", { name: "Tahsilat", exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: /Açık borçlar/ }).click();
  await expect(page.getByRole("grid", { name: "Açık borçlar", exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
});
test("an unknown collection keeps the frozen key after receipt validation failure and locks navigation", async ({
  page,
}) => {
  const state = await setup(page, { unknown: true });
  const panel = await fillCollection(page);
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "Tahsilatı kaydet", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toBeEnabled();
  await panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }).click();
  await expect(
    panel.getByText("Tahsilat ve güncel finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]!.operation_key).toBe(state.writes[1]!.operation_key);
  expect(state.writes[0]!.amount_minor).toBe(state.writes[1]!.amount_minor);
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
});

async function fillCorrection(page: Page, amount = "10000") {
  await page.getByRole("button", { name: "Düzelt", exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(panel).toHaveAccessibleName("Tahsilatı düzelt");
  await expect(panel.getByLabel("Düzeltme farkı (alt birim)", { exact: true })).toBeEnabled();
  await panel.getByLabel("Düzeltme farkı (alt birim)", { exact: true }).fill(amount);
  await panel.getByLabel("İşlem tarihi ve saati", { exact: true }).fill("2026-11-15T15:00");
  await panel.getByLabel("Gerekçe", { exact: true }).fill("Sentetik tahsilat farkı");
  return panel;
}
test("native correction previews a directed difference and rereads the linked child without rewriting the root", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await setup(page, { withCollection: true });
  const panel = await fillCorrection(page);
  await expect(panel.getByRole("radio", { name: "Nakit", exact: true })).toBeDisabled();
  expect((await scanAccessibility(page, "correction-editor")).violations).toEqual([]);
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Düzeltmeyi uygula", exact: true }),
  ).toBeDisabled();
  expect(state.corrections).toHaveLength(0);
  expect(state.previews[0]).toMatchObject({
    cash_movement_id: cashId,
    correction: {
      amount_minor: "10000",
      direction: "decrease",
      currency: "TRY",
      occurred_at: "2026-11-15T12:00:00Z",
    },
    reason: "Sentetik tahsilat farkı",
  });
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  expect((await scanAccessibility(page, "correction-review")).violations).toEqual([]);
  await panel.getByRole("button", { name: "Düzeltmeyi uygula", exact: true }).click();
  await expect(
    panel.getByText("Bağlı düzeltme ve güncel finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  expect(state.corrections).toHaveLength(1);
  await expect(
    page
      .getByRole("grid", { name: "Hareketler", exact: true })
      .getByText("₺400,00", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("grid", { name: "Hareketler", exact: true })
      .getByText("₺100,00", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Açık borçlar/ }).click();
  await expect(
    page
      .getByRole("grid", { name: "Açık borçlar", exact: true })
      .getByText("₺700,00", { exact: true }),
  ).toBeVisible();
});
test("a full collection correction restores the same debt in the cached profile without navigation reload", async ({
  page,
}) => {
  const state = await setup(page, { withCollection: true, openProfileFirst: true });
  const documentStartedAt = await page.evaluate(() => performance.timeOrigin);
  const panel = await fillCorrection(page, "40000");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "Düzeltmeyi uygula", exact: true }).click();
  await expect(
    panel.getByText("Bağlı düzeltme ve güncel finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
  expect(state.previews).toEqual([
    expect.objectContaining({
      cash_movement_id: cashId,
      correction: expect.objectContaining({ direction: "decrease", amount_minor: "40000" }),
    }),
  ]);
  expect(state.corrections).toHaveLength(1);
  await page.goBack();
  await expect(page).toHaveURL(`${origin}/o/${I.org}/c/${I.center}/people/${I.instructor}`);
  await expect(page.getByRole("definition").filter({ hasText: "₺1.000,00" })).toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStartedAt);
});

test("blocked correction has no apply action", async ({ page }) => {
  const state = await setup(page, { withCollection: true, blocked: true });
  const panel = await fillCorrection(page);
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    panel.getByText("Bu düzeltme uygulanamıyor. Koşulları kontrol edip yeni önizleme al.", {
      exact: true,
    }),
  ).toBeVisible();
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await expect(
    panel.getByRole("button", { name: "Düzeltmeyi uygula", exact: true }),
  ).toBeDisabled();
  expect(state.corrections).toHaveLength(0);
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("unknown correction keeps the reviewed capability/key after a failed receipt read", async ({
  page,
}) => {
  const state = await setup(page, { withCollection: true, correctionUnknown: true });
  const panel = await fillCorrection(page);
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "Düzeltmeyi uygula", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toBeEnabled();
  await panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }).click();
  await expect(
    panel.getByText("Bağlı düzeltme ve güncel finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(state.corrections).toHaveLength(2);
  expect(state.corrections[0]!.operation_key).toBe(state.corrections[1]!.operation_key);
  expect(state.corrections[0]!.preview).toEqual(state.corrections[1]!.preview);
  expect(state.previews).toHaveLength(1);
  expect(state.writes).toHaveLength(0);
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
});

test("a stale correction apply cannot be repeated until a fresh preview and approval", async ({
  page,
}) => {
  const state = await setup(page, { withCollection: true, stale: true });
  const panel = await fillCorrection(page);
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "Düzeltmeyi uygula", exact: true }).click();
  await expect(
    panel.getByText("Önizleme güncel değil veya süresi doldu. Geri dönüp yeni önizleme al.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Düzeltmeyi uygula", exact: true }),
  ).toBeDisabled();
  expect(state.corrections).toHaveLength(1);
  await panel.getByRole("button", { name: "Geri", exact: true }).click();
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }),
  ).not.toBeChecked();
  await expect(
    panel.getByRole("button", { name: "Düzeltmeyi uygula", exact: true }),
  ).toBeDisabled();
  expect(state.previews).toHaveLength(2);
  expect(state.corrections).toHaveLength(1);
  expect(state.writes).toHaveLength(0);
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
});

test("personal collection verifies the directory first page before returning to its totals", async ({
  page,
}) => {
  let release!: () => void;
  const readback = new Promise<void>((resolve) => {
    release = resolve;
  });
  const state = await setup(page, { directoryReadback: () => readback });
  const panel = await fillCollection(page);
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "Tahsilatı kaydet", exact: true }).click();
  try {
    await expect.poll(() => state.directoryReads.length).toBe(2);
    expect(state.directoryReads.at(-1)?.page).toEqual({ limit: 20, sort: "created_at_asc" });
    await expect(
      panel.getByText("Tahsilat ve güncel finans doğrulandı.", { exact: true }),
    ).toHaveCount(0);
  } finally {
    release();
  }
  await expect(
    panel.getByText("Tahsilat ve güncel finans doğrulandı.", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.getByRole("button", { name: "Merkez finansına dön", exact: true }).click();
  await expect(page.getByText("TRY ₺600,00", { exact: true })).toBeVisible();
  await expect(page.getByText("TRY ₺1.000,00", { exact: true })).toHaveCount(0);
  expect(state.directoryReads).toHaveLength(2);
  expect(state.writes).toHaveLength(1);
});
