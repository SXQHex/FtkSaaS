import { beforeEach, expect, it, vi } from "vitest";
import type {
  FinanceDirectoryEntry,
  FinanceDirectoryView,
} from "../../lib/api-contracts/generated";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  financePeriod,
  financeDirectoryRowKey,
  financeDirectoryTotal,
  readFinanceDirectory,
} from "./finance-directory";
const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000002",
  orgId: "019a7b00-0000-7000-8000-000000000003",
  centerId: "019a7b00-0000-7000-8000-000000000004",
};
const interval = { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" };
const row: FinanceDirectoryEntry = {
  id: scope.accountId,
  entity: { type: "people", id: scope.accountId },
  person_id: scope.accountId,
  display_name: "Synthetic",
  created_at: "2026-11-02T10:00:00Z",
  occurred_at: "2026-11-02T10:00:00Z",
  version: 1,
  kind: "credit",
  amount_minor: "200",
  currency: "TRY",
  source_sale_id: null,
  product_name: null,
  method: null,
  due_at: null,
};
const data = (): FinanceDirectoryView => ({
  items: [structuredClone(row)],
  next_cursor: null,
  as_of: "2026-11-16T10:00:00Z",
  view: "credits",
  totals: [],
});
beforeEach(() => call.mockReset());
it("uses center calendar-day boundaries including a DST transition without assuming 24-hour days", async () => {
  const period = await financePeriod("America/New_York", "2026-11-01", "2026-11-01");
  expect(period.interval).toEqual({
    starts_at: "2026-11-01T04:00:00Z",
    ends_at: "2026-11-02T05:00:00Z",
  });
  await expect(financePeriod("Europe/Istanbul", "2026-11-17", "2026-11-16")).rejects.toThrow(
    "FINANCE_PERIOD_INVALID",
  );
  await expect(financePeriod("Europe/Istanbul", "2025-01-01", "2026-11-16")).rejects.toThrow(
    "FINANCE_PERIOD_INVALID",
  );
});
it("sends native server filters with the cursor and preserves exact scope", async () => {
  const response = data();
  response.view = "movements";
  response.items = [];
  call.mockResolvedValue(response);
  await readFinanceDirectory(
    scope,
    "movements",
    interval,
    { query: " Synthetic ", kind: "refund", method: "cash" },
    "cursor-a",
  );
  expect(call).toHaveBeenCalledWith(
    "finance_directory_get_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      view: "movements",
      interval,
      query: "Synthetic",
      kind: "refund",
      method: "cash",
      page: { limit: 20, sort: "created_at_asc", cursor: "cursor-a" },
    }),
  );
});
it("keeps identical person IDs distinct across currencies and rejects actual duplicate rows", async () => {
  const response = data();
  response.items.push({ ...row, currency: "EUR" });
  call.mockResolvedValue(response);
  const result = await readFinanceDirectory(scope, "credits", interval);
  expect(new Set(result.items.map(financeDirectoryRowKey)).size).toBe(2);
  response.items.push({ ...row });
  await expect(readFinanceDirectory(scope, "credits", interval)).rejects.toThrow(
    "FINANCE_DIRECTORY_UNAVAILABLE",
  );
});
it("rejects a repeated cursor, incorrect native view and a mismatched entity", async () => {
  const response = data();
  response.next_cursor = "same";
  call.mockResolvedValue(response);
  await expect(readFinanceDirectory(scope, "credits", interval, {}, "same")).rejects.toThrow();
  response.next_cursor = null;
  await expect(readFinanceDirectory(scope, "debts", interval)).rejects.toThrow();
  response.items[0].entity.type = "sales";
  await expect(readFinanceDirectory(scope, "credits", interval)).rejects.toThrow();
});
it("rejects out-of-period movements and responses violating native filters", async () => {
  const response = data();
  response.view = "movements";
  response.items = [
    {
      ...row,
      entity: { type: "cash_movements", id: row.id },
      kind: "collection",
      occurred_at: "2026-12-01T00:00:00Z",
    },
  ];
  call.mockResolvedValue(response);
  await expect(readFinanceDirectory(scope, "movements", interval)).rejects.toThrow();
  response.items[0].occurred_at = "2026-11-03T00:00:00Z";
  await expect(
    readFinanceDirectory(scope, "movements", interval, { kind: "refund" }),
  ).rejects.toThrow();
});
it("formats arbitrary precision signed aggregate totals independently for each currency", async () => {
  const response = data();
  response.totals = [
    {
      currency: "TRY",
      sales_minor: "922337203685477580700",
      collections_minor: "-100",
      refunds_minor: "0",
      debt_minor: "100",
      credit_minor: "200",
      debt_people: 1,
      credit_people: 1,
    },
    {
      currency: "EUR",
      sales_minor: "200",
      collections_minor: "300",
      refunds_minor: "0",
      debt_minor: "0",
      credit_minor: "100",
      debt_people: 0,
      credit_people: 1,
    },
  ];
  call.mockResolvedValue(response);
  const result = await readFinanceDirectory(scope, "credits", interval);
  expect(financeDirectoryTotal(result.totals, "sales_minor")).toBe(
    "TRY ₺9.223.372.036.854.775.807,00 · EUR €2,00",
  );
  expect(financeDirectoryTotal([], "debt_minor")).toBeNull();
  response.totals.push({ ...response.totals[0] });
  await expect(readFinanceDirectory(scope, "credits", interval)).rejects.toThrow(
    "FINANCE_DIRECTORY_TOTALS_UNAVAILABLE",
  );
});
