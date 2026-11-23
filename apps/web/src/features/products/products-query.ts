import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import type { ProductView } from "@ftksaas/api-contracts";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";

export const productsKeys = {
  management: (scope: ClientScope) =>
    ["products-management", scope.accountId, scope.orgId, scope.centerId] as const,
};

export function invalidateProductPages(queries: QueryClient, scope: ClientScope) {
  return invalidateCachedFamilies(queries, [productsKeys.management(scope)]);
}

export function affectedProductQueryFamilies(
  scope: ClientScope,
  updated: ProductView["terms"],
  previous: ProductView["terms"] | undefined,
  knownCenterIds: readonly string[],
) {
  const scopes = [...updated.scopes, ...(previous?.scopes ?? [])];
  const centerIds = new Set([scope.centerId]);
  const orgWide = scopes.some((row) => row.scope_kind.startsWith("organization_"));
  if (orgWide) for (const centerId of knownCenterIds) centerIds.add(centerId);
  for (const row of scopes) if (row.center_id) centerIds.add(row.center_id);
  return [...centerIds].flatMap((centerId) => [
    ["products-management", scope.accountId, scope.orgId, centerId],
    ["profile-catalog", scope.accountId, scope.orgId, centerId],
    ["business-product-scope", scope.accountId, scope.orgId, centerId],
  ]);
}
