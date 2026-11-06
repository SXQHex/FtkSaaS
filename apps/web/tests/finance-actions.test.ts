import { expect, test } from "vitest";
import type { FinanceView } from "@ftksaas/api-contracts";
import { balanceCommand, financeActionSlot } from "../src/lib/finance-actions";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
import { discoverPendingOperations } from "../src/lib/pending-operations";
const person = "019a2b3c-4d5e-7000-8000-000000000001",
  debt = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: debt, orgId: person, centerId: debt };
const view: FinanceView = {
  person_id: person,
  currency: "TRY",
  credit_available_minor: "160000",
  debts: [
    {
      id: debt,
      center_id: debt,
      version: 7,
      due_at: "2026-11-01T10:00:00Z",
      remaining_minor: "200000",
    },
  ],
  movements: { items: [], as_of: "2026-11-06T10:00:00Z" },
};
const draft = {
  amount: "1200,50",
  debtId: debt,
  direction: "decrease",
  reason: "Müşteri talebi",
  localTime: "2026-11-06T13:00",
  timeZone: "Europe/Istanbul",
  offset: "",
};
test("credit refund records exact money, scoped source, reason and real local time", () => {
  expect(balanceCommand("student_credit_refund_v1", scope, view, draft).input).toMatchObject({
    person_id: person,
    currency: "TRY",
    amount_minor: "120050",
    reason: draft.reason,
    occurred_at: "2026-11-06T10:00:00.000Z",
  });
});
test("offset uses the selected debt's actual version and never invents a reason field", () => {
  const command = balanceCommand("student_credit_offset_v1", scope, view, draft);
  expect(command.input).toMatchObject({
    person_id: person,
    debt_id: debt,
    expected_version: 7,
    amount_minor: "120050",
    currency: "TRY",
  });
  expect(command.input).not.toHaveProperty("reason");
});
test("debt adjustment is a positive directed difference, not a new debt total", () => {
  const command = balanceCommand("debt_adjust_v1", scope, view, draft);
  expect(command.input).toMatchObject({
    debt_id: debt,
    amount_minor: "120050",
    direction: "decrease",
    reason: draft.reason,
  });
  expect(command.input).not.toHaveProperty("expected_version");
});
test.each(["student_credit_refund_v1", "student_credit_offset_v1", "debt_adjust_v1"] as const)(
  "%s rejects zero, malformed precision and foreign scope",
  (operation) => {
    for (const change of [{ amount: "0" }, { amount: "1.001" }])
      expect(() => balanceCommand(operation, scope, view, { ...draft, ...change })).toThrow(
        /invalidFinance|invalidProduct/,
      );
    expect(() => balanceCommand(operation, { ...scope, centerId: person }, view, draft)).toThrow(
      "invalidFinance",
    );
  },
);
test("offset refuses missing debt versions, duplicate/foreign debt and exhausted credit", () => {
  for (const changed of [
    { ...view, debts: [{ ...view.debts[0]!, version: undefined }] },
    { ...view, debts: [] },
    { ...view, credit_available_minor: "1" },
  ])
    expect(() => balanceCommand("student_credit_offset_v1", scope, changed, draft)).toThrow(
      "invalidFinance",
    );
});
test("credit refund refuses overdrawn credit and imaginary local time", () => {
  expect(() =>
    balanceCommand("student_credit_refund_v1", scope, view, { ...draft, amount: "2000" }),
  ).toThrow("invalidFinance");
  expect(() =>
    balanceCommand("student_credit_refund_v1", scope, view, {
      ...draft,
      localTime: "2026-03-29T02:30",
      timeZone: "Europe/Berlin",
    }),
  ).toThrow("invalidFinance");
});
test.each(["student_credit_refund_v1", "student_credit_offset_v1", "debt_adjust_v1"] as const)(
  "%s is recoverable only in its own exact family",
  (operation) => {
    sessionStorage.clear();
    const command = balanceCommand(operation, scope, view, draft),
      slot = financeActionSlot(operation, person, debt);
    sessionStorage.setItem(setupStorageKey(scope, slot), JSON.stringify({ command }));
    expect(recoverSetup(scope, slot)).toEqual({ command });
    expect(discoverPendingOperations(scope.actorId)).toEqual([{ scope, slot, kind: "finance" }]);
    sessionStorage.setItem(
      setupStorageKey(scope, `finance:${person}`),
      JSON.stringify({ command }),
    );
    expect(recoverSetup(scope, `finance:${person}`)).toBe("invalid");
    const wrongSlot = financeActionSlot(operation, debt, person);
    sessionStorage.setItem(setupStorageKey(scope, wrongSlot), JSON.stringify({ command }));
    expect(recoverSetup(scope, wrongSlot)).toBe("invalid");
    sessionStorage.clear();
  },
);
