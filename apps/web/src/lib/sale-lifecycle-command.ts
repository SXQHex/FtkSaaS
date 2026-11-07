import { v7, validate } from "uuid";
import type { Preview } from "@ftksaas/api-contracts";
import type { SetupScope } from "./studio-setup";
export const lifecycleWrites = [
  "sale_change_apply_v1",
  "freeze_apply_v1",
  "freeze_end_apply_v1",
  "sale_terminate_apply_v1",
] as const;
export type LifecycleKind = "freeze" | "freeze_end" | "terminate";
const applies = {
  freeze: "freeze_apply_v1",
  freeze_end: "freeze_end_apply_v1",
  terminate: "sale_terminate_apply_v1",
} as const;
export function lifecycleMatches(preview: Preview, saleId: string) {
  return (
    validate(preview.id) &&
    !!preview.token.trim() &&
    Date.parse(preview.expires_at) > Date.now() &&
    preview.dependencies.versions.some(
      (v) =>
        v.entity.type === "sales" &&
        v.entity.id === saleId &&
        Number.isSafeInteger(v.version) &&
        v.version > 0,
    )
  );
}
export function lifecycleCommand(scope: SetupScope, kind: LifecycleKind, preview: Preview) {
  if (!scope.centerId) throw Error("invalidLifecycle");
  return {
    operation: applies[kind],
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: v7(),
      preview: { id: preview.id, token: preview.token },
    },
  };
}
