import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { mockFinanceDirectory } from "./finance-directory-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
async function setup(page: Page, self = true) {
  const studio = await mockStudio(page),
    reads: Record<string, any>[] = [],
    people: Record<string, any>[] = [];
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON(),
      send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      deny = () =>
        route.fulfill({
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
    if (op === "organizations_list_v1")
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
              centers: self
                ? [{ center_id: I.center, student: true, instructor: false, assistant: false }]
                : [],
            },
          },
        ],
        next_cursor: null,
        as_of: "2026-11-16T10:00:00Z",
      });
    if (
      op === "roles_list_v1" ||
      op === "finance_directory_get_v1" ||
      op === "management_state_get_v1"
    )
      return deny();
    if (op === "people_list_v1") {
      people.push(req);
      return deny();
    }
    if (op === "finance_get_v1") {
      reads.push(req);
      expect(req.person_id).toBe(I.self);
      expect(req.person_id).not.toBe(I.account);
      expect(req.currency).toBe("TRY");
      expect(req.center_id).toBe(I.center);
      return send({
        person_id: I.self,
        currency: "TRY",
        credit_available_minor: "20000",
        debts: [
          {
            id: I.agreement,
            center_id: I.center,
            remaining_minor: "10000",
            due_at: "2026-12-01T00:00:00Z",
            version: 1,
          },
        ],
        movements: { items: [], next_cursor: null, as_of: "2026-11-16T10:00:00Z" },
      });
    }
    return route.fallback();
  });
  await page.goto(origin + "/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(origin + "/account");
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/finance`);
  await page.getByRole("button", { name: common.financeDirectory.personal, exact: true }).click();
  await expect.poll(() => people.length).toBe(1);
  return { studio, reads };
}
test("student self finance remains readable when people and center directory discovery are denied", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await setup(page);
  await page
    .getByRole("combobox", { name: common.finance.member, exact: true })
    .selectOption(I.self);
  await page.getByLabel(common.finance.currency, { exact: true }).fill("TRY");
  await page.getByRole("button", { name: common.finance.read, exact: true }).click();
  await expect.poll(() => state.reads.length).toBe(1);
  await expect(
    page.getByRole("button", { name: common.finance.actions.collect, exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: /Alacaklar/ }).click();
  const grid = page.getByRole("grid", { name: common.finance.credits, exact: true });
  await expect(grid.getByText("₺200,00", { exact: true })).toBeVisible();
  await expect(grid.getByText("₺100,00", { exact: true })).toBeVisible();
  await expect(grid.getByText(common.finance.self, { exact: true })).toBeVisible();
  const manager = await page.context().browser()!.newPage();
  try {
    await mockFinanceDirectory(manager);
    await manager.route("**/functions/v1/backend-v1/*", async (route) => {
      const op = new URL(route.request().url()).pathname.split("/").at(-1),
        req = route.request().postDataJSON(),
        send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
      if (op === "finance_directory_get_v1" && req.view === "credits")
        return send({
          view: "credits",
          items: [
            {
              id: I.self,
              entity: { type: "people", id: I.self },
              person_id: I.self,
              display_name: "Örnek öğrenci",
              version: 1,
              created_at: "2026-11-16T10:00:00Z",
              occurred_at: "2026-11-16T10:00:00Z",
              kind: "credit",
              amount_minor: "20000",
              currency: "TRY",
              source_sale_id: null,
              product_name: null,
              method: null,
              due_at: null,
            },
          ],
          next_cursor: null,
          as_of: "2026-11-16T10:00:00Z",
          totals: [],
        });
      if (op === "finance_get_v1") {
        expect(req.person_id).toBe(I.self);
        expect(req.currency).toBe("TRY");
        return send({
          person_id: I.self,
          currency: "TRY",
          credit_available_minor: "20000",
          debts: [
            {
              id: I.agreement,
              center_id: I.center,
              remaining_minor: "10000",
              due_at: "2026-12-01T00:00:00Z",
              version: 1,
            },
          ],
          movements: { items: [], next_cursor: null, as_of: "2026-11-16T10:00:00Z" },
        });
      }
      return route.fallback();
    });
    await manager.getByRole("tab", { name: /Alacaklar/ }).click();
    const managerGrid = manager.getByRole("grid", { name: common.finance.credits, exact: true });
    await expect(managerGrid.getByText("TRY ₺200,00", { exact: true })).toBeVisible();
    await expect(managerGrid.getByText("₺100,00", { exact: true })).toBeVisible();
    expect(await grid.getByText("₺200,00", { exact: true }).textContent()).toBe(
      (await managerGrid.getByText("TRY ₺200,00", { exact: true }).textContent())!.replace(
        "TRY ",
        "",
      ),
    );
  } finally {
    await manager.close();
  }
  expect(state.studio.writes).toHaveLength(0);
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
  expect((await scanAccessibility(page, "student-self-finance")).violations).toEqual([]);
});
test("missing native self center relationship never manufactures a person from the account ID", async ({
  page,
}) => {
  const state = await setup(page, false);
  await expect(
    page.getByRole("combobox", { name: common.finance.member, exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("option", { name: common.finance.self, exact: true })).toHaveCount(0);
  expect(state.reads).toHaveLength(0);
  expect(state.studio.writes).toHaveLength(0);
});
test("pinned native directory selection survives a denied person directory without replacing its identity", async ({
  page,
}) => {
  const state = await mockFinanceDirectory(page);
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1);
    if (op === "people_list_v1" || op === "management_state_get_v1")
      return route.fulfill({
        json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
      });
    return route.fallback();
  });
  await page.getByRole("button", { name: common.finance.actions.correct, exact: true }).click();
  const panel = page.getByRole("dialog", { name: common.finance.titles.correct, exact: true });
  await expect(panel.getByText(common.finance.authorityUnavailable, { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: common.finance.close, exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: common.finance.member, exact: true }),
  ).toHaveValue(I.instructor);
  await page.getByRole("button", { name: common.finance.read, exact: true }).click();
  await expect.poll(() => state.personalReads.length).toBeGreaterThan(0);
  expect(
    state.personalReads.every((row) => row.person_id === I.instructor && row.currency === "TRY"),
  ).toBe(true);
  expect(state.studio.writes).toHaveLength(0);
});
