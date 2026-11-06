import { actionAuthority } from "./action-authority";
import { setupCall, type SetupScope } from "./studio-setup";
import { readEntitlements } from "./products";
import type { BalanceOperation } from "./finance-actions";
export const balanceApi = {
  access: (scope: SetupScope, operation: BalanceOperation, personId: string, debtId: string) => {
    switch (operation) {
      case "student_credit_refund_v1":
        return actionAuthority(scope, { operation, key: { person_id: personId } });
      case "student_credit_offset_v1":
        return actionAuthority(scope, { operation, key: { person_id: personId, debt_id: debtId } });
      case "debt_adjust_v1":
        return actionAuthority(scope, { operation, key: { debt_id: debtId } });
    }
  },
};
export const refundApi = {
  sales: readEntitlements,
  access: (scope: SetupScope, saleId: string) =>
    actionAuthority(scope, { operation: "sale_refund_preview_v1", key: { sale_id: saleId } }),
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
