import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";

export const productsKeys = {
  management: (scope: ClientScope) =>
    ["products-management", scope.accountId, scope.orgId, scope.centerId] as const,
};

export function invalidateProductPages(queries: QueryClient, scope: ClientScope) {
  return invalidateCachedFamilies(queries, [productsKeys.management(scope)]);
}
