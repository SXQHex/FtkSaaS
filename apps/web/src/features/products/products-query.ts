import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";

export const productsKeys = {
  management: (scope: ClientScope) =>
    ["products-management", scope.accountId, scope.orgId, scope.centerId] as const,
};

export function invalidateProductPages(queries: QueryClient, scope: ClientScope) {
  return queries.invalidateQueries({
    queryKey: productsKeys.management(scope),
    refetchType: "none",
  });
}
