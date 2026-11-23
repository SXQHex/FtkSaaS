import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { retainFirstInfinitePage } from "../../lib/cache-invalidation";

export const earningsKeys = {
  directory: (scope: ClientScope) => ["earnings-directory", scope] as const,
  instructorCatalog: (scope: ClientScope) => ["earnings-instructor-catalog", scope] as const,
  visibleCounts: (scope: ClientScope) => ["earnings-visible-counts", scope] as const,
  paymentSource: (scope: ClientScope) => ["earnings-payment-source", scope] as const,
  paymentChain: (scope: ClientScope) => ["earnings-payment-chain", scope] as const,
};

export async function invalidateEarningsViews(queries: QueryClient, scope: ClientScope) {
  const tenant = [scope.accountId, scope.orgId, scope.centerId] as const;
  const families = [
    earningsKeys.directory(scope),
    earningsKeys.instructorCatalog(scope),
    earningsKeys.visibleCounts(scope),
    earningsKeys.paymentSource(scope),
    earningsKeys.paymentChain(scope),
    ["earnings-agreement-status", scope],
    ["report-view", scope, "balances", "instructor_balances"],
    ["instructor-earning-page", ...tenant],
    ["instructor-account-payments", ...tenant],
    ["instructor-account-agreements", ...tenant],
    ["instructor-month-earnings", ...tenant],
  ] as const;

  // A pre-write read must not finish after the confirmed native result and
  // overwrite its mandatory first-page readback.
  await Promise.all(families.map((queryKey) => queries.cancelQueries({ queryKey })));

  // Infinite queries must not replay server cursors issued before the write.
  // Keep the first cached page so the next observer refetch starts at page one.
  for (const prefix of [earningsKeys.instructorCatalog(scope), earningsKeys.paymentSource(scope)])
    for (const { queryKey, state } of queries.getQueryCache().findAll({ queryKey: prefix })) {
      const data = state.data;
      if (
        data &&
        typeof data === "object" &&
        "pages" in data &&
        "pageParams" in data &&
        Array.isArray(data.pages) &&
        Array.isArray(data.pageParams)
      )
        retainFirstInfinitePage(queries, queryKey);
    }

  // Old periods, people and cursors remain cached but stale, without a storm
  // of inactive-page requests or any invalidation of a different tenant.
  await Promise.all(
    families.map((queryKey) => queries.invalidateQueries({ queryKey, refetchType: "none" })),
  );
}
