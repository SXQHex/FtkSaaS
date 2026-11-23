import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { invalidateEarningsViews } from "../earnings/earnings-query";
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
    ["instructor-calendar", ...tenant],
    ["instructor-today-attendance", ...tenant],
    ["profile-reservations", ...tenant],
  ]);
}

export async function invalidateAttendanceEffects(
  queries: QueryClient,
  scope: ClientScope,
  personIds: readonly string[],
) {
  const tenant = [scope.accountId, scope.orgId, scope.centerId];
  await Promise.all([
    invalidateEarningsViews(queries, scope),
    invalidateCachedFamilies(queries, [
      ["people", ...tenant],
      ...personIds.flatMap((personId) => [
        ["profile-rights", ...tenant, personId],
        ["profile-ledger", ...tenant, personId],
        ["member-entitlements", ...tenant, personId],
      ]),
    ]),
  ]);
}
