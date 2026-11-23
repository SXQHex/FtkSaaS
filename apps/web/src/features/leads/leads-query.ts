import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { overviewWorkKey } from "../overview/overview-work";
import { reportKeys } from "../reports/reports-query";

export const leadsKeys = {
  directory: (scope: ClientScope) =>
    ["leads", scope.accountId, scope.orgId, scope.centerId] as const,
  followups: (scope: ClientScope) =>
    ["lead-followups", scope.accountId, scope.orgId, scope.centerId] as const,
  sourceFollowups: (scope: ClientScope) =>
    ["lead-source-followups", scope.accountId, scope.orgId, scope.centerId] as const,
  applications: (scope: ClientScope) =>
    ["lead-applications", scope.accountId, scope.orgId, scope.centerId] as const,
  summary: (scope: ClientScope) =>
    ["lead-work-summary", scope.accountId, scope.orgId, scope.centerId] as const,
};

export function invalidateLeadPages(queries: QueryClient, scope: ClientScope) {
  return invalidateCachedFamilies(queries, [
    leadsKeys.directory(scope),
    leadsKeys.followups(scope),
    leadsKeys.sourceFollowups(scope),
    leadsKeys.applications(scope),
    leadsKeys.summary(scope),
    overviewWorkKey(scope),
    [...reportKeys.views(scope), "crm", "crm_conversion"],
  ]);
}

export function applicationDetailFamilies(
  queries: QueryClient,
  scope: Pick<ClientScope, "accountId" | "orgId">,
  id: string,
  verifiedCenterId?: string,
) {
  return queries
    .getQueryCache()
    .findAll({
      queryKey: ["lead-application", scope.accountId, scope.orgId],
      predicate: ({ queryKey }) => queryKey[4] === id && queryKey[3] !== verifiedCenterId,
    })
    .map(({ queryKey }) => queryKey);
}
