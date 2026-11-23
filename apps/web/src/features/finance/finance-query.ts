import { capturePrivateReadback } from "../../lib/cache-invalidation";
import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { reportCollectionFamilies, reportSalesFamilies } from "../reports/reports-query";

export const financeKeys = {
  person: (scope: ClientScope, personId: string, currency: string) =>
    ["finance", scope.accountId, scope.orgId, scope.centerId, personId, currency] as const,
  directory: (scope: ClientScope) =>
    ["finance-directory", scope.accountId, scope.orgId, scope.centerId] as const,
  creditDebt: (scope: ClientScope, personId: string, currency: string) =>
    [
      "finance-directory-credit-debts",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      currency,
    ] as const,
};

export async function invalidateFinanceViews(
  queries: QueryClient,
  scope: ClientScope,
  personId: string,
  currency: string,
) {
  const assertCurrent = capturePrivateReadback(queries);
  const tenant = [scope.accountId, scope.orgId, scope.centerId] as const;
  const families: (readonly unknown[])[] = [
    financeKeys.person(scope, personId, currency),
    ["profile-person", ...tenant, personId],
    ["people", ...tenant],
    ["lesson-requests", ...tenant],
    financeKeys.directory(scope),
    ["member-entitlements", ...tenant, personId],
    ...reportCollectionFamilies(scope),
    ...reportSalesFamilies(scope),
  ];

  // Credit balance reads belong to a person and a currency, even when the
  // directory displays multiple currencies side by side. Support older
  // combined-page keys without refreshing unaffected currency-only queries.
  const affectedCredit = `people:${personId}:credit:${currency}`;
  const creditKeys = queries
    .getQueryCache()
    .findAll({ queryKey: ["finance-directory-credit-debts", ...tenant] })
    .filter(({ queryKey }) => {
      if (typeof queryKey[4] === "string" && typeof queryKey[5] === "string")
        return queryKey[4] === personId && queryKey[5] === currency;
      if (Array.isArray(queryKey[5])) return queryKey[5].includes(affectedCredit);
      return true;
    })
    .map(({ queryKey }) => queryKey);

  // A read started before a confirmed native write must not replace its
  // readback. Never refetch every historical cursor or report in this step.
  await Promise.all([
    ...families.map((queryKey) => queries.cancelQueries({ queryKey })),
    ...creditKeys.map((queryKey) => queries.cancelQueries({ queryKey, exact: true })),
  ]);
  assertCurrent();
  await Promise.all([
    ...families.map((queryKey) => queries.invalidateQueries({ queryKey, refetchType: "none" })),
    ...creditKeys.map((queryKey) =>
      queries.invalidateQueries({ queryKey, exact: true, refetchType: "none" }),
    ),
  ]);
}
