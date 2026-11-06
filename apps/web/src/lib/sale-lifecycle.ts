import { setupCall, type SetupScope } from "./studio-setup";
export {
  lifecycleWrites,
  lifecycleMatches,
  lifecycleCommand,
  type LifecycleKind,
} from "./sale-lifecycle-command";
export const lifecycleApi = {
  freeze: (scope: SetupScope, saleId: string, start: string, end: string, reason: string) =>
    setupCall("freeze_preview_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      sale_id: saleId,
      dates: { start_date: start, end_date: end },
      reason,
    }),
  end: (scope: SetupScope, freezeId: string, end: string, reason: string) =>
    setupCall("freeze_end_preview_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      freeze_id: freezeId,
      end_date: end,
      reason,
    }),
  terminate: (scope: SetupScope, saleId: string, reason: string) =>
    setupCall("sale_terminate_preview_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      sale_id: saleId,
      reason,
    }),
};
export type LifecycleApi = typeof lifecycleApi;
