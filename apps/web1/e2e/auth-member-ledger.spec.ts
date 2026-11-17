import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type { EntitlementView, EntitlementLedgerItem } from "../src/lib/api-contracts/generated.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
const sale = "019a7b00-0000-7000-8000-000000000070",
  secondSale = "019a7b00-0000-7000-8000-000000000071";
async function setup(
  page: Page,
  options: { denied?: boolean; empty?: boolean; noMembership?: boolean; noRights?: boolean } = {},
) {
  const studio = await mockStudio(page),
    reads: Record<string, any>[] = [],
    personReads: Record<string, any>[] = [];
  const entitlement: EntitlementView = {
    sale_id: sale,
    person_id: I.instructor,
    start_date: "2026-11-15",
    end_date: "2026-12-15",
    timezone: "Europe/Istanbul",
    state: "active",
    available: 8,
    reserved: 1,
    consumed: 0,
    deficit: 0,
    quotas: [],
    deficit_scopes: [],
    kind: "credits",
    booking_mode: "flexible",
    version: 2,
  };
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON(),
      send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "person_get_v1") {
      personReads.push(req);
      expect(req.include_membership_date).toBe(true);
      expect(req.include_member_summary).toBe(true);
      return send({
        ...studio.people[0],
        membership_started_at: options.noMembership ? null : "2026-11-13T22:00:00Z",
      });
    }
    if (op === "products_list_v1")
      return send({ items: [], next_cursor: null, as_of: "2026-11-16T10:00:00Z" });
    if (op === "entitlements_get_v1") {
      expect(req.person_id).toBe(I.instructor);
      expect(req.center_id).toBe(I.center);
      const rows = [
        { ...entitlement },
        { ...entitlement, sale_id: secondSale, start_date: "2026-11-16" },
      ];
      if (options.noRights) return send([]);
      if (req.ledger_sale_id) {
        reads.push(req);
        expect([sale, secondSale]).toContain(req.ledger_sale_id);
        expect(req.ledger_page.limit).toBe(20);
        expect(req.ledger_page.sort).toBe("created_at_asc");
        if (options.denied)
          return route.fulfill({
            json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
          });
        const item: EntitlementLedgerItem = {
          id: req.ledger_page.cursor ? I.availability : I.role,
          created_at: "2026-11-15T23:30:00Z",
          kind: req.ledger_page.cursor ? "reserve" : "grant",
          quantity: req.ledger_page.cursor ? 1 : 8,
          balance_delta: req.ledger_page.cursor ? 0 : 8,
          previous_id: null,
          source: {
            type: req.ledger_page.cursor ? "reservations" : "sales",
            id: req.ledger_page.cursor ? I.availability : req.ledger_sale_id,
          },
        };
        const row = rows.find((row) => row.sale_id === req.ledger_sale_id)!;
        return send(
          rows.map((value) =>
            value.sale_id === row.sale_id
              ? {
                  ...value,
                  movements: {
                    items: options.empty ? [] : [item],
                    next_cursor: !options.empty && !req.ledger_page.cursor ? "native-next" : null,
                    as_of: "2026-11-16T10:00:00Z",
                  },
                }
              : value,
          ),
        );
      }
      return send(rows);
    }
    return route.fallback();
  });
  await page.goto(origin + "/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(origin + "/account");
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/people/${I.instructor}`);
  await expect(page.getByRole("heading", { name: "Örnek Eğitmen", exact: true })).toBeVisible();
  const panel = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: common.memberProfile.ledger, exact: true }) })
    .last();
  return { studio, reads, personReads, panel };
}
test("mobile profile reads canonical membership date and only explicitly selected sale ledger pages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await setup(page);
  await expect(page.getByText("Üye: 14 Kas 2026", { exact: true })).toBeVisible();
  expect(state.reads).toHaveLength(0);
  await state.panel
    .getByRole("combobox", { name: common.memberProfile.ledgerSale, exact: true })
    .selectOption(sale);
  expect(state.reads).toHaveLength(0);
  await state.panel
    .getByRole("button", { name: common.memberProfile.readLedger, exact: true })
    .click();
  await expect(state.panel.getByText("Miktar 8 · Bakiye farkı +8", { exact: true })).toBeVisible();
  await expect(state.panel.getByText(`Kaynak: Satış · ${sale}`, { exact: true })).toBeVisible();
  await state.panel.getByRole("button", { name: common.finance.next, exact: true }).click();
  await expect(state.panel.getByText("Miktar 1 · Bakiye farkı 0", { exact: true })).toBeVisible();
  await expect(state.panel.getByText("16.11.2026 02:30", { exact: true })).toBeVisible();
  await expect(
    state.panel.getByText(`Kaynak: Rezervasyon · ${I.availability}`, { exact: true }),
  ).toBeVisible();
  expect(state.reads.at(-1)?.ledger_page.cursor).toBe("native-next");
  await state.panel
    .getByRole("combobox", { name: common.memberProfile.ledgerSale, exact: true })
    .selectOption(secondSale);
  await expect(state.panel.getByText("Miktar 1 · Bakiye farkı 0", { exact: true })).toHaveCount(0);
  expect(state.reads.at(-1)?.ledger_sale_id).toBe(sale);
  await state.panel
    .getByRole("button", { name: common.memberProfile.readLedger, exact: true })
    .click();
  await expect.poll(() => state.reads.at(-1)?.ledger_sale_id).toBe(secondSale);
  expect(state.reads.at(-1)?.ledger_page.cursor).toBeUndefined();
  expect(state.studio.writes).toHaveLength(0);
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
  expect((await scanAccessibility(page, "member-ledger-mobile")).violations).toEqual([]);
});
test("ledger permission denial preserves independently readable profile and never becomes empty history", async ({
  page,
}) => {
  const state = await setup(page, { denied: true });
  await state.panel
    .getByRole("combobox", { name: common.memberProfile.ledgerSale, exact: true })
    .selectOption(sale);
  await state.panel
    .getByRole("button", { name: common.memberProfile.readLedger, exact: true })
    .click();
  await expect(
    state.panel.getByText(common.memberProfile.ledgerError, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Örnek Eğitmen", exact: true })).toBeVisible();
  await expect(state.panel.getByText(common.memberProfile.noRecords, { exact: true })).toHaveCount(
    0,
  );
  expect(state.studio.writes).toHaveLength(0);
});
test("null membership does not use account or creation date, while a successful empty ledger stays empty", async ({
  page,
}) => {
  const state = await setup(page, { empty: true, noMembership: true });
  await expect(page.getByText(/^Üye:/)).toHaveCount(0);
  await state.panel
    .getByRole("combobox", { name: common.memberProfile.ledgerSale, exact: true })
    .selectOption(sale);
  await state.panel
    .getByRole("button", { name: common.memberProfile.readLedger, exact: true })
    .click();
  await expect(
    state.panel.getByText(common.memberProfile.noRecords, { exact: true }),
  ).toBeVisible();
  await expect(
    state.panel.getByRole("button", { name: common.finance.next, exact: true }),
  ).toBeDisabled();
  expect(state.studio.writes).toHaveLength(0);
});

test("an authorized profile without rights reports no visible source and never invents ledger history", async ({
  page,
}) => {
  const state = await setup(page, { noRights: true });
  await expect(
    state.panel.getByText(common.memberProfile.ledgerNoSource, { exact: true }),
  ).toBeVisible();
  await expect(
    state.panel.getByRole("combobox", { name: common.memberProfile.ledgerSale, exact: true }),
  ).toBeDisabled();
  await expect(
    state.panel.getByRole("button", { name: common.memberProfile.readLedger, exact: true }),
  ).toBeDisabled();
  expect(state.reads).toHaveLength(0);
});
