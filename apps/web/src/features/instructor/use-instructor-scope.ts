import { useWorkspaceQuery } from "../workspace/workspace-query";

import type { ClientScope } from "../../lib/scoped-backend";

export function useInstructorScope(scope: ClientScope, preservePending = false) {
  const workspace = useWorkspaceQuery(scope.accountId, scope.orgId, false);
  const current =
    (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
      ? workspace.data
      : undefined;
  const center = current?.centers.find((row) => row.id === scope.centerId && row.accessible);
  const identity = current?.selected?.self_context;
  const self = identity?.centers.find((row) => row.center_id === scope.centerId);
  return { workspace, center, identity, self };
}
