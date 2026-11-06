import { validate, v7 } from "uuid";
import type { FinanceView } from "@ftksaas/api-contracts";
import { money } from "./collection-command";
import { priceToMinor } from "./product-terms";
import { localTimeChoices } from "./session-change";
import type { SetupScope } from "./studio-setup";
export const balanceOperations = [
  "student_credit_refund_v1",
  "student_credit_offset_v1",
  "debt_adjust_v1",
] as const;
export type BalanceOperation = (typeof balanceOperations)[number];
export const balanceFields = {
  student_credit_refund_v1: ["person_id", "amount_minor", "currency", "occurred_at", "reason"],
  student_credit_offset_v1: [
    "person_id",
    "debt_id",
    "amount_minor",
    "currency",
    "expected_version",
  ],
  debt_adjust_v1: ["debt_id", "amount_minor", "direction", "reason"],
};
const uuid = (value: unknown): value is string => typeof value === "string" && validate(value);
const reason = (value: unknown) =>
  typeof value === "string" && !!value.trim() && value.length <= 10000;
export function financeActionSlot(operation: BalanceOperation, personId: string, debtId: string) {
  return operation === "debt_adjust_v1"
    ? `debt-adjust:${debtId}`
    : `${operation === "student_credit_refund_v1" ? "credit-refund" : "credit-offset"}:${personId}`;
}
export function validBalanceCommand(
  operation: BalanceOperation,
  input: Record<string, unknown>,
  centerId: string | undefined,
  slot: string,
) {
  if (
    !centerId ||
    input.center_id !== centerId ||
    !money(input.amount_minor) ||
    BigInt(input.amount_minor as string) <= 0n
  )
    return false;
  if (operation === "debt_adjust_v1")
    return (
      uuid(input.debt_id) &&
      slot === `debt-adjust:${input.debt_id}` &&
      reason(input.reason) &&
      (input.direction === "increase" || input.direction === "decrease")
    );
  if (
    !uuid(input.person_id) ||
    typeof input.currency !== "string" ||
    !/^[A-Z]{3}$/.test(input.currency)
  )
    return false;
  if (operation === "student_credit_offset_v1")
    return (
      slot === `credit-offset:${input.person_id}` &&
      uuid(input.debt_id) &&
      Number.isSafeInteger(input.expected_version) &&
      Number(input.expected_version) > 0
    );
  return (
    slot === `credit-refund:${input.person_id}` &&
    reason(input.reason) &&
    typeof input.occurred_at === "string" &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.occurred_at) &&
    Number.isFinite(Date.parse(input.occurred_at))
  );
}
export type BalanceDraft = {
  amount: string;
  debtId: string;
  direction: string;
  reason: string;
  localTime: string;
  timeZone: string;
  offset: string;
};
export function balanceCommand(
  operation: BalanceOperation,
  scope: SetupScope,
  view: FinanceView,
  draft: BalanceDraft,
) {
  if (
    !scope.centerId ||
    !uuid(view.person_id) ||
    !money(view.credit_available_minor) ||
    view.debts.some((row) => row.center_id && row.center_id !== scope.centerId)
  )
    throw Error("invalidFinance");
  const amount = priceToMinor(draft.amount, view.currency);
  if (BigInt(amount) <= 0n) throw Error("invalidFinance");
  const common = {
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation_key: v7(),
    amount_minor: amount,
  };
  if (operation === "student_credit_refund_v1") {
    const choices = localTimeChoices(draft.localTime, draft.timeZone);
    const instant =
      choices.length === 1
        ? choices[0]?.instant
        : choices.find((row) => row.instant === draft.offset)?.instant;
    if (!instant || !reason(draft.reason) || BigInt(amount) > BigInt(view.credit_available_minor))
      throw Error("invalidFinance");
    return {
      operation,
      input: {
        ...common,
        person_id: view.person_id,
        currency: view.currency,
        occurred_at: instant,
        reason: draft.reason.trim(),
      },
    };
  }
  const matches = view.debts.filter((row) => row.id === draft.debtId),
    debt = matches[0];
  if (matches.length !== 1 || !debt || !uuid(debt.id) || !money(debt.remaining_minor))
    throw Error("invalidFinance");
  if (operation === "student_credit_offset_v1") {
    if (
      !Number.isSafeInteger(debt.version) ||
      Number(debt.version) <= 0 ||
      BigInt(amount) > BigInt(debt.remaining_minor) ||
      BigInt(amount) > BigInt(view.credit_available_minor)
    )
      throw Error("invalidFinance");
    return {
      operation,
      input: {
        ...common,
        person_id: view.person_id,
        debt_id: debt.id,
        currency: view.currency,
        expected_version: debt.version!,
      },
    };
  }
  if (!reason(draft.reason) || !["increase", "decrease"].includes(draft.direction))
    throw Error("invalidFinance");
  return {
    operation,
    input: {
      ...common,
      debt_id: debt.id,
      direction: draft.direction as "increase" | "decrease",
      reason: draft.reason.trim(),
    },
  };
}
