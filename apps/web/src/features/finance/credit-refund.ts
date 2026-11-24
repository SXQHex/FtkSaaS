import { readFinanceOperationReceipt } from "./finance-receipt";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import type { RequestStudentCreditRefund } from "@ftksaas/api-contracts";
import { readFinancePage, type FinanceSelection } from "./finance";
import type { FinanceDraft } from "./finance-action-sheet";

export interface CreditRefundIntent {
  scope: ClientScope;
  selection: FinanceSelection;
  operation: "student_credit_refund_v1";
  request: Omit<RequestStudentCreditRefund, "request_id">;
}
export async function readCreditRefundSource(scope: ClientScope, selection: FinanceSelection) {
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "student_credit_refund_v1",
    selector: { operation: "student_credit_refund_v1", key: { person_id: selection.personId } },
    page: { limit: 1 },
  });
  const item = Array.isArray(page?.items) ? page.items[0] : undefined;
  if (
    item?.exists !== true ||
    page.items.length !== 1 ||
    page.next_cursor ||
    item.entity?.type !== "people" ||
    item.entity.id !== selection.personId ||
    item.current?.operation !== "student_credit_refund_v1" ||
    item.current.values?.person_id !== selection.personId
  )
    throw new Error("FINANCE_AUTHORITY_UNAVAILABLE");
  return readFinancePage(scope, selection);
}
export async function creditRefundIntent(
  scope: ClientScope,
  selection: FinanceSelection,
  timezone: string,
  draft: FinanceDraft,
): Promise<CreditRefundIntent> {
  const value = z
    .object({
      personId: z.uuid(),
      currency: z.string().regex(/^[A-Z]{3}$/),
      amount: z
        .string()
        .regex(/^[1-9][0-9]{0,18}$/)
        .refine((v) => BigInt(v) <= 9223372036854775807n),
      reason: z.string().trim().min(1),
      occurredAt: z.string().min(1),
    })
    .parse(draft);
  if (value.personId !== selection.personId || value.currency !== selection.currency)
    throw new Error("FINANCE_SCOPE_CHANGED");
  const temporal = await getTemporal();
  let occurred_at: string;
  try {
    occurred_at = temporal.PlainDateTime.from(value.occurredAt)
      .toZonedDateTime(timezone, { disambiguation: "reject" })
      .toInstant()
      .toString();
  } catch {
    throw new Error("FINANCE_TIME_INVALID");
  }
  return {
    scope: { ...scope },
    selection: { ...selection },
    operation: "student_credit_refund_v1",
    request: {
      client_api_version: 1,
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: uuidv7(),
      person_id: value.personId,
      currency: value.currency,
      amount_minor: value.amount,
      occurred_at,
      reason: value.reason,
    },
  };
}
export async function writeCreditRefund(intent: CreditRefundIntent) {
  const backend = await scopedBackend(intent.scope);
  const result = await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  z.uuid().parse(result.primary_id);
  return result;
}
export function readCreditRefundReceipt(intent: CreditRefundIntent) {
  return readFinanceOperationReceipt(intent);
}
export async function readCreditRefundResult(
  intent: CreditRefundIntent,
  id?: string,
  onFirstPage?: (view: Awaited<ReturnType<typeof readFinancePage>>) => void,
) {
  z.uuid().parse(id);
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const data = await readFinancePage(intent.scope, intent.selection, cursor);
    if (!cursor) onFirstPage?.(data);
    const row = data.movements.items.find((item) => item.id === id);
    if (row) {
      if (
        row.kind !== "refund" ||
        row.amount_minor !== intent.request.amount_minor ||
        row.currency !== intent.request.currency ||
        row.previous_id ||
        row.payment ||
        Date.parse(row.occurred_at) !== Date.parse(intent.request.occurred_at)
      )
        throw new Error("FINANCE_RESULT_UNAVAILABLE");
      return data;
    }
    cursor = data.movements.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw new Error("FINANCE_RESULT_UNAVAILABLE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  throw new Error("FINANCE_RESULT_UNAVAILABLE");
}
