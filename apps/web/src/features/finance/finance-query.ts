import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";

export const financeKeys = {
  person: (scope: ClientScope, personId: string, currency: string) =>
    ["finance", scope.accountId, scope.orgId, scope.centerId, personId, currency] as const,
  directory: (scope: ClientScope) =>
    ["finance-directory", scope.accountId, scope.orgId, scope.centerId] as const,
  creditDebt: (scope: ClientScope, personId: string, currency: string) =>
    ["finance-directory-credit-debts", scope.accountId, scope.orgId, scope.centerId, personId, currency] as const,
};

export async function invalidateFinanceViews(
  queries: QueryClient,
  scope: ClientScope,
  personId: string,
  currency: string,
) {
  const tenant = [scope.accountId, scope.orgId, scope.centerId] as const;
  const families: (readonly unknown[])[] = [
    financeKeys.person(scope, personId, currency),
    ["profile-person", ...tenant, personId],
    ["people", ...tenant],
    financeKeys.directory(scope),
    ["member-entitlements", ...tenant, personId],
    ["report-finance-summary", scope],
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

  // Only monetary reports change after a collection, correction or refund.
  // Session metrics, instructor balances and CRM reports are independent.
  const reportKeys = queries
    .getQueryCache()
    .findAll({ queryKey: ["report-view", scope] })
    .filter(({ queryKey }) => ["sales", "collection_breakdown"].includes(String(queryKey[3])))
    .map(({ queryKey }) => queryKey);

  // A read started before a confirmed native write must not replace its
  // readback. Never refetch every historical cursor or report in this step.
  await Promise.all([
    ...families.map((queryKey) => queries.cancelQueries({ queryKey })),
    ...[...creditKeys, ...reportKeys].map((queryKey) =>
      queries.cancelQueries({ queryKey, exact: true }),
    ),
  ]);
  await Promise.all([
    ...families.map((queryKey) =>
      queries.invalidateQueries({ queryKey, refetchType: "none" }),
    ),
    ...[...creditKeys, ...reportKeys].map((queryKey) =>
      queries.invalidateQueries({ queryKey, exact: true, refetchType: "none" }),
    ),
  ]);
}
