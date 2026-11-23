import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { invalidateEarningsViews } from "../earnings/earnings-query";
import { productsKeys } from "../products/products-query";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { scheduleCacheKeys, sessionScheduleFamilies } from "../schedule/schedule-cache";

export const sessionDetailKeys = {
  center: (scope: ClientScope) =>
    ["session-detail", scope.accountId, scope.orgId, scope.centerId] as const,
  session: (scope: ClientScope, sessionId: string) =>
    [...sessionDetailKeys.center(scope), sessionId] as const,
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
    ...sessionScheduleFamilies(scope),
    scheduleCacheKeys.instructorSession(scope),
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
      ["lesson-requests", ...tenant],
      productsKeys.management(scope),
      ...personIds.flatMap((personId) => [
        ["profile-person", ...tenant, personId],
        ["profile-rights", ...tenant, personId],
        ["profile-ledger", ...tenant, personId],
        ["member-entitlements", ...tenant, personId],
      ]),
    ]),
  ]);
}
