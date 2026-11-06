import { ApiFailure } from "./api";
import { setupCall, type SetupInput, type SetupScope } from "./studio-setup";
import { readEntitlements } from "./products";
import type { BalanceOperation } from "./finance-actions";
type Selector = Extract<
  NonNullable<SetupInput<"management_state_get_v1">["selector"]>,
  { operation: BalanceOperation | "sale_refund_preview_v1" }
>;
async function available(scope: SetupScope, selector: Selector) {
  try {
    const page = await setupCall("management_state_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: selector.operation,
      selector,
    });
    return page.items.some(
      (item) =>
        item.operation === selector.operation &&
        item.current?.operation === selector.operation &&
        Object.entries(selector.key).every(([name, value]) =>
          Object.entries(item.current!.values).some(
            ([key, current]) => key === name && current === value,
          ),
        ),
    );
  } catch (cause) {
    if (
      cause instanceof ApiFailure &&
      ["FORBIDDEN", "NOT_FOUND"].includes(cause.failure.error.code)
    )
      return false;
    throw cause;
  }
}
export const balanceApi = {
  access: (scope: SetupScope, operation: BalanceOperation, personId: string, debtId: string) => {
    switch (operation) {
      case "student_credit_refund_v1":
        return available(scope, { operation, key: { person_id: personId } });
      case "student_credit_offset_v1":
        return available(scope, { operation, key: { person_id: personId, debt_id: debtId } });
      case "debt_adjust_v1":
        return available(scope, { operation, key: { debt_id: debtId } });
    }
  },
};
export const refundApi = {
  sales: readEntitlements,
  access: (scope: SetupScope, saleId: string) =>
    available(scope, { operation: "sale_refund_preview_v1", key: { sale_id: saleId } }),
  preview: (scope: SetupScope, saleId: string, reason: string) =>
    setupCall("sale_refund_preview_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      sale_id: saleId,
      reason,
    }),
};
export type BalanceApi = typeof balanceApi;
export type RefundApi = typeof refundApi;
