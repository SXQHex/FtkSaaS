import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { OperationStatusView } from "@ftksaas/api-contracts";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";

const resultTypes = {
  collection_record_v1: "cash_movements",
  collection_correct_apply_v1: "cash_movements",
  student_credit_refund_v1: "cash_movements",
  sale_refund_apply_v1: "sales",
  debt_adjust_v1: "debt_adjustments",
  student_credit_offset_v1: "student_credit_movements",
} as const satisfies Partial<
  Record<
    OperationStatusView["operation"],
    NonNullable<OperationStatusView["result_reference"]>["type"]
  >
>;

export async function readFinanceOperationReceipt(intent: {
  scope: ClientScope;
  operation: keyof typeof resultTypes;
  request: { operation_key: string };
}): Promise<OperationStatusView> {
  const { operation, request, scope } = intent;
  const backend = await scopedBackend(scope);
  const native = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    operation,
    key: request.operation_key,
  });
  const parsed = z
    .object({
      operation: z.literal(operation),
      key: z.literal(request.operation_key),
      status: z.enum(["in_progress", "succeeded", "failed_final", "result_expired"]),
      result_available: z.boolean(),
      result_reference: z
        .object({ type: z.literal(resultTypes[operation]), id: z.guid() })
        .nullable(),
    })
    .safeParse(native);
  if (!parsed.success)
    throw new Error(
      operation === "sale_refund_apply_v1"
        ? "SALE_REFUND_RECEIPT_UNAVAILABLE"
        : "FINANCE_RECEIPT_UNAVAILABLE",
    );
  return parsed.data;
}
