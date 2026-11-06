import { validate, v7 } from "uuid";
import type { EntitlementView, Preview, PreviewToken } from "@ftksaas/api-contracts";
import type { SetupScope } from "./studio-setup";
export function refundSourcesMatch(rows: EntitlementView[], personId: string) {
  const ids = new Set<string>();
  return rows.every((row) => {
    if (
      row.person_id !== personId ||
      !validate(row.sale_id) ||
      ids.has(row.sale_id) ||
      ![row.available, row.reserved, row.consumed].every(
        (value) => Number.isSafeInteger(value) && value >= 0,
      )
    )
      return false;
    ids.add(row.sale_id);
    return true;
  });
}
export function refundMatches(preview: Preview, saleId: string) {
  return preview.dependencies.versions.some(
    (row) =>
      row.entity.type === "sales" &&
      row.entity.id === saleId &&
      Number.isSafeInteger(row.version) &&
      row.version > 0,
  );
}
export function saleRefundCommand(scope: SetupScope, preview: PreviewToken) {
  return {
    operation: "sale_refund_apply_v1" as const,
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: v7(),
      preview: { id: preview.id, token: preview.token },
    },
  };
}
