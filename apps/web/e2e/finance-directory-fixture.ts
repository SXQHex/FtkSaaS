import { activate } from "./device-input.js";
import { expect, type Page } from "@playwright/test";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import type {
  FinanceDirectoryEntry,
  FinanceDirectoryView,
  RequestFinanceDirectoryGet,
  RequestFinanceGet,
} from "@ftksaas/api-contracts";
export async function mockFinanceDirectory(
  page: Page,
  options: { denied?: boolean; malformed?: boolean; creditDenied?: boolean } = {},
) {
  const studio = await mockStudio(page),
    requests: RequestFinanceDirectoryGet[] = [],
    personalReads: RequestFinanceGet[] = [];
  const totals = [
    {
      currency: "TRY",
      sales_minor: "100000",
      collections_minor: "40000",
      refunds_minor: "0",
      debt_minor: "60000",
      credit_minor: "20000",
      debt_people: 2,
      credit_people: 1,
    },
    {
      currency: "EUR",
      sales_minor: "20000",
      collections_minor: "10000",
      refunds_minor: "0",
      debt_minor: "10000",
      credit_minor: "5000",
      debt_people: 1,
      credit_people: 1,
    },
  ];
  const base: FinanceDirectoryEntry = {
    id: I.role,
    entity: { type: "cash_movements", id: I.role },
    person_id: I.instructor,
    display_name: "Örnek Eğitmen",
    created_at: "2026-11-15T10:00:00Z",
    occurred_at: "2026-11-15T10:00:00Z",
    version: 2,
    kind: "collection",
    amount_minor: "40000",
    currency: "TRY",
    source_sale_id: null,
    product_name: null,
    method: "cash",
    due_at: null,
  };
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON(),
      send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      deny = () =>
        route.fulfill({
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
    if (op === "finance_directory_get_v1") {
      requests.push(req);
      expect(req.org_id).toBe(I.org);
      expect(req.center_id).toBe(I.center);
      expect(req.page.limit).toBe(20);
      if (options.denied) return deny();
      let items: FinanceDirectoryEntry[] = [];
      if (req.view === "movements")
        items = req.page.cursor
          ? [
              {
                ...base,
                id: I.agreement,
                entity: { type: "cash_movements", id: I.agreement },
                display_name: "İkinci sayfa üyesi",
              },
            ]
          : [
              { ...base },
              {
                ...base,
                id: I.lesson,
                entity: { type: "sales", id: I.lesson },
                kind: "sale",
                source_sale_id: I.lesson,
                product_name: "8 derslik paket",
                method: null,
                amount_minor: "100000",
              },
            ];
      if (req.view === "debts")
        items = [
          {
            ...base,
            id: I.agreement,
            entity: { type: "debts", id: I.agreement },
            kind: "debt",
            amount_minor: totals[0].debt_minor,
            source_sale_id: I.lesson,
            product_name: "8 derslik paket",
            method: null,
            due_at: "2026-12-01T00:00:00Z",
          },
        ];
      if (req.view === "credits")
        items = [
          {
            ...base,
            id: I.instructor,
            entity: { type: "people", id: I.instructor },
            kind: "credit",
            method: null,
            amount_minor: "20000",
          },
          {
            ...base,
            id: I.instructor,
            entity: { type: "people", id: I.instructor },
            kind: "credit",
            method: null,
            amount_minor: "5000",
            currency: "EUR",
          },
        ];
      if (req.query) items = items.filter((row) => row.display_name?.includes(req.query));
      if (req.kind) items = items.filter((row) => row.kind === req.kind);
      if (req.method) items = items.filter((row) => row.method === req.method);
      if (options.malformed && items[0]) items[0].entity = { type: "sales", id: I.self };
      const data: FinanceDirectoryView = {
        view: req.view,
        items,
        next_cursor:
          req.view === "movements" && !req.page.cursor && !req.query && !req.kind && !req.method
            ? "native-next"
            : null,
        as_of: "2026-11-16T10:00:00Z",
        totals,
      };
      return send(data);
    }
    if (op === "finance_get_v1") {
      personalReads.push(req);
      if (options.creditDenied) return deny();
      return send({
        person_id: req.person_id,
        currency: req.currency,
        credit_available_minor: req.currency === "EUR" ? "5000" : "20000",
        debts: [
          {
            id: I.agreement,
            due_at: "2026-12-01T00:00:00Z",
            remaining_minor: req.currency === "EUR" ? "10000" : "60000",
            center_id: I.center,
            version: 2,
          },
        ],
        movements: { items: [], next_cursor: null, as_of: "2026-11-16T10:00:00Z" },
      });
    }
    if (op === "management_state_get_v1" && req.operation === "collection_record_v1") return deny();
    return route.fallback();
  });
  await page.goto(origin + "/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await activate(page.getByRole("button", { name: "Giriş yap", exact: true }));
  await expect(page).toHaveURL(origin + "/account");
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/finance`);
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  return { studio, requests, personalReads, totals };
}
