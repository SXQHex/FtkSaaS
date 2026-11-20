import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  DebtSummary,
  FinanceView,
  RequestDebtAdjust,
  RequestStudentCreditOffset,
} from "@ftksaas/api-contracts";
import { readFinancePage, type FinanceSelection } from "./finance";
import type { FinanceDraft } from "./finance-action-sheet";
export type DebtAction = "offset" | "adjust";
export interface DebtBase {
  scope: ClientScope;
  selection: FinanceSelection;
  action: DebtAction;
  debt: DebtSummary & { version: number };
  available: string;
}
type Common = { scope: ClientScope; selection: FinanceSelection; base: DebtBase };
export type DebtIntent = Common &
  (
    | {
        operation: "student_credit_offset_v1";
        request: Omit<RequestStudentCreditOffset, "request_id">;
      }
    | { operation: "debt_adjust_v1"; request: Omit<RequestDebtAdjust, "request_id"> }
  );
export async function readDebtBase(
  scope: ClientScope,
  selection: FinanceSelection,
  id: string,
  action: DebtAction,
): Promise<DebtBase> {
  z.uuid().parse(id);
  const selector =
    action === "offset"
      ? {
          operation: "student_credit_offset_v1" as const,
          key: { debt_id: id, person_id: selection.personId },
        }
      : { operation: "debt_adjust_v1" as const, key: { debt_id: id } };
  const operation = selector.operation;
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation,
    selector,
    page: { limit: 1 },
  });
  const item = page.items[0],
    versions = item?.versions.filter((x) => x.entity.type === "debts" && x.entity.id === id) ?? [];
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !item?.exists ||
    item.entity?.type !== "debts" ||
    item.entity.id !== id ||
    item.current?.operation !== operation ||
    item.current.values.debt_id !== id ||
    (item.current.operation === "student_credit_offset_v1" &&
      item.current.values.person_id !== selection.personId) ||
    versions.length !== 1 ||
    !Number.isSafeInteger(versions[0]!.version) ||
    versions[0]!.version < 1
  )
    throw new Error("FINANCE_AUTHORITY_UNAVAILABLE");
  const source = await readFinancePage(scope, selection),
    debt = source.debts.find((x) => x.id === id);
  if (!debt || debt.version !== versions[0]!.version || debt.center_id !== scope.centerId)
    throw new Error("FINANCE_SOURCE_UNAVAILABLE");
  return {
    scope: { ...scope },
    selection: { ...selection },
    action,
    debt: { ...debt, version: versions[0]!.version },
    available: source.credit_available_minor,
  };
}
export function debtIntent(base: DebtBase, draft: FinanceDraft): DebtIntent {
  const value = z
    .object({
      personId: z.uuid(),
      debtId: z.uuid(),
      currency: z.string().regex(/^[A-Z]{3}$/),
      amount: z
        .string()
        .regex(/^[1-9][0-9]{0,18}$/)
        .refine((v) => BigInt(v) <= 9223372036854775807n),
    })
    .parse(draft);
  if (
    value.personId !== base.selection.personId ||
    value.currency !== base.selection.currency ||
    value.debtId !== base.debt.id
  )
    throw new Error("FINANCE_SCOPE_CHANGED");
  const common = {
    scope: { ...base.scope },
    selection: { ...base.selection },
    base: structuredClone(base),
  };
  const request = {
    client_api_version: 1 as const,
    org_id: base.scope.orgId,
    center_id: base.scope.centerId,
    operation_key: uuidv7(),
    debt_id: base.debt.id,
    amount_minor: value.amount,
  };
  if (base.action === "offset") {
    if (
      BigInt(value.amount) > BigInt(base.available) ||
      BigInt(value.amount) > BigInt(base.debt.remaining_minor)
    )
      throw new Error("FINANCE_OFFSET_INSUFFICIENT");
    return {
      ...common,
      operation: "student_credit_offset_v1",
      request: {
        ...request,
        person_id: value.personId,
        currency: value.currency,
        expected_version: base.debt.version,
      },
    };
  }
  const adjustment = z
    .object({ direction: z.enum(["increase", "decrease"]), reason: z.string().trim().min(1) })
    .parse(draft);
  return {
    ...common,
    operation: "debt_adjust_v1",
    request: { ...request, direction: adjustment.direction, reason: adjustment.reason },
  };
}
export async function writeDebt(intent: DebtIntent) {
  const backend = await scopedBackend(intent.scope);
  const result =
    intent.operation === "debt_adjust_v1"
      ? await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() })
      : await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  z.uuid().parse(result.primary_id);
  return result;
}
export async function readDebtReceipt(intent: DebtIntent) {
  const backend = await scopedBackend(intent.scope);
  const result = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  const type =
    intent.operation === "debt_adjust_v1" ? "debt_adjustments" : "student_credit_movements";
  if (
    result.operation !== intent.operation ||
    result.key !== intent.request.operation_key ||
    (result.result_reference && result.result_reference.type !== type)
  )
    throw new Error("FINANCE_RECEIPT_UNAVAILABLE");
  return result;
}
export async function readDebtResult(intent: DebtIntent, id?: string): Promise<FinanceView> {
  // The ACK/receipt identifies the mutation fact. Finance publishes the known
  // debt projection, not the private adjustment/credit fact as a cash movement.
  z.uuid().parse(id);
  const data = await readFinancePage(intent.scope, intent.selection),
    debt = data.debts.find((x) => x.id === intent.base.debt.id);
  if (
    !debt ||
    debt.center_id !== intent.scope.centerId ||
    !Number.isSafeInteger(debt.version) ||
    debt.version! <= intent.base.debt.version
  )
    throw new Error("FINANCE_RESULT_UNAVAILABLE");
  return data;
}
