import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";

export const sessionDetailKeys = {
  session: (scope: ClientScope, sessionId: string) =>
    ["session-detail", scope.accountId, scope.orgId, scope.centerId, sessionId] as const,
  participants: (scope: ClientScope, sessionId: string, personId?: string, cursor?: string) =>
    [...sessionDetailKeys.session(scope, sessionId), "participants", personId, cursor] as const,
};

export async function invalidateSessionDetailViews(
  queries: QueryClient,
  scope: ClientScope,
  sessionId: string,
) {
  const tenant = [scope.accountId, scope.orgId, scope.centerId] as const;
  await invalidateCachedFamilies(queries, [
    sessionDetailKeys.session(scope, sessionId),
    ["schedule-range", ...tenant],
    ["profile-reservations", ...tenant],
  ]);
}
