import { validate, v7 } from "uuid";
import type { EarningView, P03PaymentView } from "@ftksaas/api-contracts";
import type { SetupScope } from "./studio-setup";
import { priceToMinor } from "./product-terms";
import { localTimeChoices } from "./session-change";
import { money } from "./collection-command";
export const paymentFields = {
  instructor_payment_record_v1: [
    "person_id",
    "earning_ids",
    "amount_minor",
    "currency",
    "occurred_at",
  ],
  instructor_payment_correct_v1: ["payment_id", "expected_version", "correction", "reason"],
};
export type PaymentWrite = keyof typeof paymentFields;
export const paymentWrites = Object.keys(paymentFields) as PaymentWrite[];
const uuid = (x: unknown): x is string => typeof x === "string" && validate(x);
const instant = (x: unknown) =>
  typeof x === "string" && /(?:Z|[+-]\d\d:\d\d)$/.test(x) && Number.isFinite(Date.parse(x));
export function validPaymentCommand(
  operation: string,
  input: Record<string, unknown>,
  centerId: string | undefined,
  slot: string,
) {
  if (!centerId || input.center_id !== centerId) return false;
  if (operation === "instructor_payment_record_v1")
    return (
      uuid(input.person_id) &&
      slot === `earnings:${input.person_id}` &&
      Array.isArray(input.earning_ids) &&
      input.earning_ids.length > 0 &&
      input.earning_ids.every(uuid) &&
      new Set(input.earning_ids).size === input.earning_ids.length &&
      typeof input.amount_minor === "string" &&
      money(input.amount_minor) &&
      BigInt(input.amount_minor) > 0n &&
      typeof input.currency === "string" &&
      /^[A-Z]{3}$/.test(input.currency) &&
      instant(input.occurred_at)
    );
  const c = input.correction;
  if (
    operation !== "instructor_payment_correct_v1" ||
    !c ||
    typeof c !== "object" ||
    Array.isArray(c)
  )
    return false;
  const values = c as Record<string, unknown>;
  return (
    uuid(input.payment_id) &&
    slot === `instructor-payment:${input.payment_id}` &&
    Number.isSafeInteger(input.expected_version) &&
    Number(input.expected_version) > 0 &&
    typeof input.reason === "string" &&
    !!input.reason.trim() &&
    input.reason.length <= 10000 &&
    Object.keys(values).length === 4 &&
    typeof values.amount_minor === "string" &&
    money(values.amount_minor) &&
    BigInt(values.amount_minor) > 0n &&
    typeof values.currency === "string" &&
    /^[A-Z]{3}$/.test(values.currency) &&
    instant(values.occurred_at) &&
    ["increase", "decrease"].includes(String(values.direction))
  );
}
export type PaymentDraft = {
  amount: string;
  currency: string;
  localTime: string;
  timeZone: string;
  offset: string;
  earningIds: string[];
  payment?: P03PaymentView;
  direction?: "increase" | "decrease";
  reason?: string;
};
export function paymentCommand(
  scope: SetupScope,
  personId: string,
  rows: readonly EarningView[],
  draft: PaymentDraft,
) {
  if (
    !scope.centerId ||
    !uuid(personId) ||
    rows.some((r) => r.person_id !== personId || r.center_id !== scope.centerId)
  )
    throw Error("invalidEarnings");
  const amount = priceToMinor(draft.amount, draft.currency),
    choices = localTimeChoices(draft.localTime, draft.timeZone),
    time =
      choices.length === 1
        ? choices[0]?.instant
        : choices.find((c) => c.instant === draft.offset)?.instant;
  if (!time || Date.parse(time) > Date.now() || BigInt(amount) <= 0n)
    throw Error("invalidEarnings");
  const common = { org_id: scope.orgId, center_id: scope.centerId, operation_key: v7() };
  if (draft.payment) {
    const payment = draft.payment,
      reason = draft.reason?.trim();
    if (
      !rows.some((row) =>
        row.payments?.some(
          (source) =>
            source.id === payment.id && JSON.stringify(source) === JSON.stringify(payment),
        ),
      ) ||
      !uuid(payment.id) ||
      payment.currency !== draft.currency ||
      !Number.isSafeInteger(payment.version) ||
      payment.version < 1 ||
      !reason ||
      reason.length > 10000 ||
      !["increase", "decrease"].includes(draft.direction ?? "")
    )
      throw Error("invalidEarnings");
    return {
      slot: `instructor-payment:${payment.id}`,
      command: {
        operation: "instructor_payment_correct_v1" as const,
        input: {
          ...common,
          payment_id: payment.id,
          expected_version: payment.version,
          correction: {
            amount_minor: amount,
            currency: payment.currency,
            occurred_at: time,
            direction: draft.direction!,
          },
          reason,
        },
      },
    };
  }
  if (
    !draft.earningIds.length ||
    new Set(draft.earningIds).size !== draft.earningIds.length ||
    draft.earningIds.some(
      (id) =>
        !rows.some(
          (r) =>
            r.id === id &&
            r.currency === draft.currency &&
            r.previous_id === null &&
            BigInt(r.remaining_minor) > 0n,
        ),
    )
  )
    throw Error("invalidEarnings");
  return {
    slot: `earnings:${personId}`,
    command: {
      operation: "instructor_payment_record_v1" as const,
      input: {
        ...common,
        person_id: personId,
        earning_ids: draft.earningIds,
        amount_minor: amount,
        currency: draft.currency,
        occurred_at: time,
      },
    },
  };
}
