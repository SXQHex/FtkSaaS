import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { financeKeys } from "../finance/finance-query";
import { peopleKeys } from "../people/people-query";
import { invalidateProductSalesViews } from "../products/products-query";
import { reportCollectionFamilies, reportSalesFamilies } from "./reports-query";

export async function invalidateStudentImportViews(queries: QueryClient, scope: ClientScope) {
  // The terminal import summary covers every applied row, while the visible
  // page only includes some of the affected people and currencies.
  const tenant = [scope.accountId, scope.orgId, scope.centerId] as const;
  await Promise.all([
    invalidateCachedFamilies(queries, [
      peopleKeys.center(scope),
      peopleKeys.picker(scope),
      financeKeys.directory(scope),
      ["finance", ...tenant],
      ["finance-directory-credit-debts", ...tenant],
      ["profile-person", ...tenant],
      ["profile-rights", ...tenant],
      ["profile-ledger", ...tenant],
      ["member-entitlements", ...tenant],
      ["booking-rights", ...tenant],
      ["lesson-requests", ...tenant],
      ["event-registration-rights", ...tenant],
      ["merge-directory", ...tenant],
      ...reportSalesFamilies(scope),
      ...reportCollectionFamilies(scope),
    ]),
    invalidateProductSalesViews(queries, scope),
  ]);
}
