import { beforeEach, expect, it, vi } from "vitest";
import type { CashSummary, FinanceView } from "../../lib/api-contracts/generated";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  creditRefundIntent,
  readCreditRefundSource,
  writeCreditRefund,
  readCreditRefundReceipt,
  readCreditRefundResult,
} from "./credit-refund";
import { financeDraft } from "./finance";
const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000002",
  orgId: "019a7b00-0000-7000-8000-000000000003",
  centerId: "019a7b00-0000-7000-8000-000000000004",
};
const selection = { personId: "019a7b00-0000-7000-8000-000000000006", currency: "TRY" },
  id = "019a7b00-0000-7000-8000-000000000065";
const draft = () => ({
  ...financeDraft(selection),
  amount: "10000",
  reason: "Synthetic cash refund",
  occurredAt: "2026-11-15T15:00",
});
const row: CashSummary = {
  id,
  kind: "refund",
  amount_minor: "10000",
  currency: "TRY",
  occurred_at: "2026-11-15T12:00:00+00:00",
  center_id: scope.centerId,
  payment: null,
  previous_id: null,
};
const data = (rows: CashSummary[] = [row]): FinanceView => ({
  person_id: selection.personId,
  currency: "TRY",
  credit_available_minor: "20000",
  debts: [],
  movements: { items: rows, next_cursor: null, as_of: "2026-11-15T13:00:00Z" },
});
beforeEach(() => call.mockReset());
it("requires the refund action authority rather than collection permission or finance read", async () => {
  const item = {
    exists: true,
    entity: { type: "people", id: selection.personId },
    current: { operation: "student_credit_refund_v1", values: { person_id: selection.personId } },
  };
  call.mockResolvedValueOnce({ items: [item], next_cursor: null }).mockResolvedValueOnce(data());
  expect((await readCreditRefundSource(scope, selection)).credit_available_minor).toBe("20000");
  expect(call.mock.calls[0]![1].selector).toEqual({
    operation: "student_credit_refund_v1",
    key: { person_id: selection.personId },
  });
  call.mockResolvedValue({
    items: [{ ...item, current: { ...item.current, operation: "collection_record_v1" } }],
  });
  await expect(readCreditRefundSource(scope, selection)).rejects.toThrow(
    "FINANCE_AUTHORITY_UNAVAILABLE",
  );
});
it("constructs native cash refund without fabricated payment, debt, expected version or preview", async () => {
  const intent = await creditRefundIntent(scope, selection, "Europe/Istanbul", draft());
  expect(intent.request).toMatchObject({
    amount_minor: "10000",
    currency: "TRY",
    reason: "Synthetic cash refund",
    occurred_at: "2026-11-15T12:00:00Z",
  });
  for (const field of ["payment", "debt_id", "expected_version", "preview"])
    expect(intent.request).not.toHaveProperty(field);
  await expect(
    creditRefundIntent(scope, { ...selection, currency: "USD" }, "Europe/Istanbul", draft()),
  ).rejects.toThrow("FINANCE_SCOPE_CHANGED");
  await expect(
    creditRefundIntent(scope, selection, "America/New_York", {
      ...draft(),
      occurredAt: "2026-11-01T01:30",
    }),
  ).rejects.toThrow("FINANCE_TIME_INVALID");
});
it("rejects invalid, zero, out-of-range money and blank reason before any native write", async () => {
  for (const amount of ["0", "-1", "1.5", "9223372036854775808"])
    await expect(
      creditRefundIntent(scope, selection, "Europe/Istanbul", { ...draft(), amount }),
    ).rejects.toThrow();
  await expect(
    creditRefundIntent(scope, selection, "Europe/Istanbul", { ...draft(), reason: "  " }),
  ).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
});
it("preserves the exact reviewed key and request on transport retries", async () => {
  const intent = await creditRefundIntent(scope, selection, "Europe/Istanbul", draft());
  call.mockResolvedValue({ primary_id: id });
  await writeCreditRefund(intent);
  await writeCreditRefund(intent);
  const a = call.mock.calls[0]![1],
    b = call.mock.calls[1]![1];
  expect(a.request_id).not.toBe(b.request_id);
  expect({ ...a, request_id: null }).toEqual({ ...b, request_id: null });
});
it("rereads exact native refund through cursors and rejects a collection or wrong amount", async () => {
  const intent = await creditRefundIntent(scope, selection, "Europe/Istanbul", draft());
  call
    .mockResolvedValueOnce({
      ...data([]),
      movements: { ...data().movements, items: [], next_cursor: "next" },
    })
    .mockResolvedValueOnce(data());
  expect((await readCreditRefundResult(intent, id)).credit_available_minor).toBe("20000");
  expect(call.mock.calls[1]![1].page.cursor).toBe("next");
  for (const changed of [
    { ...row, kind: "collection" as const },
    { ...row, amount_minor: "20000" },
  ]) {
    call.mockResolvedValue(data([changed]));
    await expect(readCreditRefundResult(intent, id)).rejects.toThrow("FINANCE_RESULT_UNAVAILABLE");
  }
});
it("rejects unrelated receipt references before accepting ACK recovery", async () => {
  const intent = await creditRefundIntent(scope, selection, "Europe/Istanbul", draft());
  call.mockResolvedValue({
    operation: intent.operation,
    key: intent.request.operation_key,
    result_reference: { type: "student_credit_movements", id },
  });
  await expect(readCreditRefundReceipt(intent)).rejects.toThrow("FINANCE_RECEIPT_UNAVAILABLE");
});
