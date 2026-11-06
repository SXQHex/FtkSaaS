import { validate, v7 } from "uuid";
import type { FinanceView, ManualCollectionPayment } from "@ftksaas/api-contracts";
import { priceToMinor } from "./product-terms";
import { localTimeChoices } from "./session-change";
import type { SetupScope } from "./studio-setup";
export const money = (v: unknown) =>
  typeof v === "string" && /^(0|[1-9][0-9]{0,18})$/.test(v) && BigInt(v) <= 9223372036854775807n;
export type CollectionDraft = {
  amount: string;
  method: string;
  reference: string;
  localTime: string;
  timeZone: string;
  offset: string;
  debtIds: string[];
  allocation: string;
  note: string;
};
export function collectionCommand(scope: SetupScope, view: FinanceView, draft: CollectionDraft) {
  if (
    !scope.centerId ||
    view.debts.some((row) => row.center_id && row.center_id !== scope.centerId)
  )
    throw Error("invalidFinance");
  const amount = priceToMinor(draft.amount, view.currency),
    reference = draft.reference.trim();
  if (
    BigInt(amount) <= 0n ||
    !["cash", "bank_transfer", "card_pos"].includes(draft.method) ||
    (draft.method !== "cash" && !reference)
  )
    throw Error("invalidFinance");
  const choices = localTimeChoices(draft.localTime, draft.timeZone),
    instant =
      choices.length === 1
        ? choices[0]?.instant
        : choices.find((row) => row.instant === draft.offset)?.instant;
  if (!instant || !["automatic", "selected"].includes(draft.allocation))
    throw Error("invalidFinance");
  if (
    draft.allocation === "selected" &&
    (!draft.debtIds.length ||
      new Set(draft.debtIds).size !== draft.debtIds.length ||
      draft.debtIds.some(
        (id) => !view.debts.some((row) => row.id === id && BigInt(row.remaining_minor) > 0n),
      ))
  )
    throw Error("invalidFinance");
  return {
    operation: "collection_record_v1" as const,
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: v7(),
      person_id: view.person_id,
      amount_minor: amount,
      currency: view.currency,
      occurred_at: instant,
      payment: {
        method: draft.method as ManualCollectionPayment["method"],
        ...(reference ? { reference } : {}),
      },
      ...(draft.allocation === "selected" ? { debt_ids: draft.debtIds } : {}),
      ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
    },
  };
}
export function validCollection(input: Record<string, unknown>, centerId?: string) {
  const payment = input.payment as Record<string, unknown> | undefined;
  return (
    !!centerId &&
    input.center_id === centerId &&
    typeof input.person_id === "string" &&
    validate(input.person_id) &&
    money(input.amount_minor) &&
    BigInt(input.amount_minor as string) > 0n &&
    typeof input.currency === "string" &&
    /^[A-Z]{3}$/.test(input.currency) &&
    typeof input.occurred_at === "string" &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.occurred_at) &&
    Number.isFinite(Date.parse(input.occurred_at)) &&
    !!payment &&
    Object.keys(payment).every((key) => ["method", "reference"].includes(key)) &&
    typeof payment.method === "string" &&
    ["cash", "bank_transfer", "card_pos"].includes(payment.method) &&
    (payment.reference === undefined ||
      (typeof payment.reference === "string" && !!payment.reference.trim())) &&
    (payment.method === "cash" ||
      (typeof payment.reference === "string" && !!payment.reference.trim())) &&
    (input.note === undefined || (typeof input.note === "string" && !!input.note.trim())) &&
    (input.debt_ids === undefined ||
      (Array.isArray(input.debt_ids) &&
        input.debt_ids.length > 0 &&
        new Set(input.debt_ids).size === input.debt_ids.length &&
        input.debt_ids.every((id) => typeof id === "string" && validate(id))))
  );
}
