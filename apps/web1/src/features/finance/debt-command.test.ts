import { beforeEach, expect, it, vi } from "vitest";
import type { FinanceView } from "../../lib/api-contracts/generated";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  readDebtBase,
  debtIntent,
  writeDebt,
  readDebtReceipt,
  readDebtResult,
  type DebtBase,
} from "./debt-command";
import { financeDraft } from "./finance";
const scope = {
    accountId: "019a7b00-0000-7000-8000-000000000002",
    orgId: "019a7b00-0000-7000-8000-000000000003",
    centerId: "019a7b00-0000-7000-8000-000000000004",
  },
  selection = { personId: "019a7b00-0000-7000-8000-000000000006", currency: "TRY" },
  id = "019a7b00-0000-7000-8000-000000000062",
  fact = "019a7b00-0000-7000-8000-000000000067";
const debt = {
  id,
  remaining_minor: "60000",
  center_id: scope.centerId,
  version: 2,
  due_at: "2026-11-15T00:00:00Z",
};
const base: DebtBase = { scope, selection, action: "offset", debt, available: "20000" };
const draft = () => ({
  ...financeDraft(selection),
  debtId: id,
  amount: "10000",
  reason: "Synthetic debt correction",
});
const data = (): FinanceView => ({
  person_id: selection.personId,
  currency: "TRY",
  credit_available_minor: "10000",
  debts: [{ ...debt, version: 3, remaining_minor: "50000" }],
  movements: { items: [], next_cursor: null, as_of: "2026-11-15T13:00:00Z" },
});
beforeEach(() => call.mockReset());
it("binds live action authority, exact debt version and scoped finance before review", async () => {
  const operation = "student_credit_offset_v1",
    key = { person_id: selection.personId, debt_id: id };
  const item = {
    exists: true,
    entity: { type: "debts", id },
    versions: [{ entity: { type: "debts", id }, version: 2 }],
    current: { operation, values: key },
  };
  call.mockResolvedValueOnce({ items: [item] }).mockResolvedValueOnce({ ...data(), debts: [debt] });
  expect((await readDebtBase(scope, selection, id, "offset")).debt.version).toBe(2);
  expect(call.mock.calls[0]![1].selector).toEqual({ operation, key });
  call.mockResolvedValueOnce({ items: [item] }).mockResolvedValueOnce(data());
  await expect(readDebtBase(scope, selection, id, "offset")).rejects.toThrow(
    "FINANCE_SOURCE_UNAVAILABLE",
  );
  call.mockResolvedValue({
    items: [{ ...item, current: { operation, values: { ...key, person_id: fact } } }],
  });
  await expect(readDebtBase(scope, selection, id, "offset")).rejects.toThrow(
    "FINANCE_AUTHORITY_UNAVAILABLE",
  );
});
it("uses the authoritative version only for offset and never adds cash/date/reason fields", () => {
  const intent = debtIntent(base, draft());
  expect(intent.operation).toBe("student_credit_offset_v1");
  expect(intent.request).toMatchObject({
    expected_version: 2,
    person_id: selection.personId,
    debt_id: id,
    amount_minor: "10000",
    currency: "TRY",
  });
  for (const field of ["reason", "occurred_at", "payment"])
    expect(intent.request).not.toHaveProperty(field);
  expect(() => debtIntent(base, { ...draft(), amount: "30000" })).toThrow(
    "FINANCE_OFFSET_INSUFFICIENT",
  );
  expect(() =>
    debtIntent({ ...base, available: "100000" }, { ...draft(), amount: "70000" }),
  ).toThrow("FINANCE_OFFSET_INSUFFICIENT");
});
it("uses a directed debt difference and reason without inventing expected_version or currency", () => {
  const intent = debtIntent({ ...base, action: "adjust" }, { ...draft(), direction: "increase" });
  expect(intent.request).toMatchObject({
    debt_id: id,
    amount_minor: "10000",
    direction: "increase",
    reason: "Synthetic debt correction",
  });
  for (const field of ["expected_version", "currency", "person_id", "payment"])
    expect(intent.request).not.toHaveProperty(field);
  expect(() => debtIntent({ ...base, action: "adjust" }, { ...draft(), reason: "  " })).toThrow();
  expect(() => debtIntent(base, { ...draft(), debtId: fact })).toThrow("FINANCE_SCOPE_CHANGED");
});
it("keeps the same offset key/payload on an unknown retry with fresh request ids", async () => {
  const intent = debtIntent(base, draft());
  call.mockResolvedValue({ primary_id: fact });
  await writeDebt(intent);
  await writeDebt(intent);
  const a = call.mock.calls[0]![1],
    b = call.mock.calls[1]![1];
  expect(a.request_id).not.toBe(b.request_id);
  expect({ ...a, request_id: null }).toEqual({ ...b, request_id: null });
});
it("checks the receipt fact type for each operation rather than expecting a cash movement", async () => {
  for (const action of ["offset", "adjust"] as const) {
    const intent = debtIntent({ ...base, action }, draft());
    call.mockResolvedValue({
      operation: intent.operation,
      key: intent.request.operation_key,
      result_reference: {
        type: action === "offset" ? "student_credit_movements" : "debt_adjustments",
        id: fact,
      },
    });
    await expect(readDebtReceipt(intent)).resolves.toBeDefined();
    call.mockResolvedValue({
      operation: intent.operation,
      key: intent.request.operation_key,
      result_reference: { type: "cash_movements", id: fact },
    });
    await expect(readDebtReceipt(intent)).rejects.toThrow("FINANCE_RECEIPT_UNAVAILABLE");
  }
});
it("requires an ACK identity and newer native debt projection without fabricating cash history or totals", async () => {
  const intent = debtIntent(base, draft());
  call.mockResolvedValue(data());
  expect((await readDebtResult(intent, fact)).debts[0]!.remaining_minor).toBe("50000");
  await expect(readDebtResult(intent)).rejects.toThrow();
  call.mockResolvedValue({ ...data(), debts: [debt] });
  await expect(readDebtResult(intent, fact)).rejects.toThrow("FINANCE_RESULT_UNAVAILABLE");
  call.mockResolvedValue({ ...data(), debts: [] });
  await expect(readDebtResult(intent, fact)).rejects.toThrow("FINANCE_RESULT_UNAVAILABLE");
});
