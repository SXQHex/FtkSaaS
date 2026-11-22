import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";

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

export async function invalidateLeadPages(queries: QueryClient, scope: ClientScope) {
  await Promise.all(
    [
      leadsKeys.directory(scope),
      leadsKeys.followups(scope),
      leadsKeys.sourceFollowups(scope),
      leadsKeys.applications(scope),
      leadsKeys.summary(scope),
    ].map((queryKey) => queries.invalidateQueries({ queryKey, refetchType: "none" })),
  );
}
