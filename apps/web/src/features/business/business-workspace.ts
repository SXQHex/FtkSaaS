import { queryOptions } from "@tanstack/react-query";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";

export function businessWorkspaceQuery(scope: ClientScope) {
  return queryOptions({
    queryKey: ["business-workspace", scope.accountId, scope.orgId, scope.centerId],
    queryFn: async (context) => {
      const backend = await scopedBackend(scope, undefined, context);
      const end = Date.now();
      try {
        const result = await backend.call("report_get_v1", {
          client_api_version: 1,
          request_id: uuidv7(),
          org_id: scope.orgId,
          center_id: scope.centerId,
          report: "cross_center_usage",
          page: { limit: 1 },
          filters: {
            center_ids: [scope.centerId],
            interval: {
              starts_at: new Date(end - 1000).toISOString(),
              ends_at: new Date(end).toISOString(),
            },
          },
        });
        return (
          result.report_kind === "cross_center_usage" &&
          result.filters.center_ids.length === 1 &&
          result.filters.center_ids[0] === scope.centerId
        );
      } catch (error) {
        if (
          error instanceof BackendError &&
          ["FORBIDDEN", "PLAN_FEATURE_UNAVAILABLE"].includes(error.code)
        )
          return false;
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}
