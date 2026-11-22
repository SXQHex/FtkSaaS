import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";

export const financeKeys = {
  person: (scope: ClientScope, personId: string, currency: string) =>
    ["finance", scope.accountId, scope.orgId, scope.centerId, personId, currency] as const,
};

export async function invalidateFinanceViews(
  queries: QueryClient,
  scope: ClientScope,
  personId: string,
  currency: string,
) {
  const tenant = [scope.accountId, scope.orgId, scope.centerId] as const;
  // Do not redispatch an acknowledged writer or reread every cached cursor.
  // The active finance page performs its required readback separately.
  await Promise.all(
    [
      financeKeys.person(scope, personId, currency),
      ["profile-person", ...tenant, personId],
      ["people", ...tenant],
      ["finance-directory", ...tenant],
      ["finance-directory-credit-debts", ...tenant],
      ["member-entitlements", ...tenant, personId],
    ].map((queryKey) => queries.invalidateQueries({ queryKey, refetchType: "none" })),
  );
}
