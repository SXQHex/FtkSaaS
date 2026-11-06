import { validate, v7 } from "uuid";
import type { CashSummary, PreviewToken } from "@ftksaas/api-contracts";
import { ApiFailure } from "./api";
import { priceToMinor } from "./product-terms";
import { localTimeChoices } from "./session-change";
import { setupCall, type SetupInput, type SetupScope } from "./studio-setup";
export type CorrectionDraft = {
  amount: string;
  direction: string;
  reason: string;
  localTime: string;
  timeZone: string;
  offset: string;
};
export function correctionInput(
  scope: SetupScope,
  movement: CashSummary,
  draft: CorrectionDraft,
): SetupInput<"collection_correct_preview_v1"> {
  const amount = priceToMinor(draft.amount, movement.currency);
  const choices = localTimeChoices(draft.localTime, draft.timeZone);
  const instant =
    choices.length === 1
      ? choices[0]?.instant
      : choices.find((row) => row.instant === draft.offset)?.instant;
  if (
    !scope.centerId ||
    (movement.center_id && movement.center_id !== scope.centerId) ||
    movement.kind !== "collection" ||
    !validate(movement.id) ||
    BigInt(amount) === 0n ||
    !["increase", "decrease"].includes(draft.direction) ||
    !draft.reason.trim() ||
    draft.reason.trim().length > 10000 ||
    !instant
  )
    throw Error("invalidFinance");
  return {
    org_id: scope.orgId,
    center_id: scope.centerId,
    cash_movement_id: movement.id,
    reason: draft.reason.trim(),
    correction: {
      amount_minor: amount,
      currency: movement.currency,
      direction: draft.direction as "increase" | "decrease",
      occurred_at: instant,
    },
  };
}
export function correctionCommand(scope: SetupScope, preview: PreviewToken) {
  return {
    operation: "collection_correct_apply_v1" as const,
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: v7(),
      preview: { id: preview.id, token: preview.token },
    },
  };
}
export function validCorrection(input: Record<string, unknown>, centerId?: string) {
  const preview = input.preview;
  if (
    !centerId ||
    input.center_id !== centerId ||
    !preview ||
    typeof preview !== "object" ||
    Array.isArray(preview)
  )
    return false;
  const value = preview as Record<string, unknown>;
  return (
    Object.keys(value).length === 2 &&
    typeof value.id === "string" &&
    validate(value.id) &&
    typeof value.token === "string" &&
    !!value.token.trim()
  );
}
export const correctionApi = {
  canCorrect: async (scope: SetupScope, movementId: string) => {
    try {
      const page = await setupCall("management_state_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation: "collection_correct_preview_v1",
        selector: {
          operation: "collection_correct_preview_v1",
          key: { cash_movement_id: movementId },
        },
      });
      return page.items.some(
        (item) =>
          item.operation === "collection_correct_preview_v1" &&
          item.current?.operation === "collection_correct_preview_v1" &&
          item.current.values.cash_movement_id === movementId,
      );
    } catch (cause) {
      if (
        cause instanceof ApiFailure &&
        ["FORBIDDEN", "NOT_FOUND"].includes(cause.failure.error.code)
      )
        return false;
      throw cause;
    }
  },
  preview: (input: SetupInput<"collection_correct_preview_v1">) =>
    setupCall("collection_correct_preview_v1", input),
};
export type CorrectionApi = typeof correctionApi;
