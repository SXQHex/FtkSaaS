import { useQuery } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { readWorkspace } from "../workspace/workspace";
export function useInstructorScope(scope: ClientScope, preservePending = false) {
  const workspace = useQuery({
    queryKey: ["workspace", scope.accountId, scope.orgId],
    queryFn: () => readWorkspace(scope.accountId, scope.orgId),
    enabled: false,
    retry: false,
  });
  const current =
    (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
      ? workspace.data
      : undefined;
  const center = current?.centers.find((row) => row.id === scope.centerId && row.accessible);
  const identity = current?.selected?.self_context;
  const self = identity?.centers.find((row) => row.center_id === scope.centerId);
  return { workspace, center, identity, self };
}
