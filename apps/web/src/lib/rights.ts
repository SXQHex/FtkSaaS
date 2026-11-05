import { v7 } from "uuid";
import type { ReservationProtectionPreview } from "@ftksaas/api-contracts";
import { getSession } from "./api";
import { productDisciplines } from "./products";
import { setupCall, type SetupScope, type SetupCommand } from "./studio-setup";
import type { RightsChange } from "./rights-change";
export const rightsApi = {
  disciplines: productDisciplines,
  limits: (scope: SetupScope, personId: string, disciplineId: string) => {
    if (!scope.centerId) throw Error("invalidRights");
    return setupCall("negative_limits_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
      discipline_id: disciplineId,
    });
  },
  preview: (scope: SetupScope, change: RightsChange, reason: string) =>
    setupCall("reservation_impact_preview_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      change,
      reason,
    }),
  session: (scope: SetupScope, sessionId: string) =>
    getSession(scope.orgId, scope.centerId, sessionId),
};
export type RightsApi = typeof rightsApi;
export function rightsCommand(
  scope: SetupScope,
  change: RightsChange,
  reason: string,
  result: ReservationProtectionPreview,
  expectedVersion?: number,
): SetupCommand {
  if (!scope.centerId) throw Error("invalidRights");
  const input = {
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation_key: v7(),
    reason,
    impact_approval: { id: result.preview.id, token: result.preview.token },
    accepted_reservation_ids: result.affected.map((row) => row.reservation_id),
  };
  if (change.kind === "credit_adjust")
    return {
      operation: "credit_adjust_v1",
      input: {
        ...input,
        sale_id: change.sale_id,
        quantity: change.quantity,
        direction: change.direction,
      },
    };
  if (!expectedVersion || !Number.isSafeInteger(expectedVersion)) throw Error("invalidRights");
  if (change.kind === "entitlement_extend")
    return {
      operation: "entitlement_extend_v1",
      input: {
        ...input,
        sale_id: change.sale_id,
        end_date: change.end_date,
        expected_version: expectedVersion,
      },
    };
  return {
    operation: "negative_limit_set_v1",
    input: {
      ...input,
      person_id: change.person_id,
      discipline_id: change.discipline_id,
      allowed_negative_credits: change.allowed_negative_credits,
      expected_version: expectedVersion,
    },
  };
}
