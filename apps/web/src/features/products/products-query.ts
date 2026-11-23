import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import type { ProductView } from "@ftksaas/api-contracts";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";

export const productsKeys = {
  management: (scope: ClientScope) =>
    ["products-management", scope.accountId, scope.orgId, scope.centerId] as const,
  history: (scope: ClientScope, productId: string) =>
    ["product-history", scope.accountId, scope.orgId, scope.centerId, productId] as const,
  eventChoices: (scope: ClientScope) =>
    ["event-choices", scope.accountId, scope.orgId, scope.centerId, "products"] as const,
};

export function invalidateProductPages(queries: QueryClient, scope: ClientScope) {
  return invalidateCachedFamilies(queries, [productsKeys.management(scope)]);
}

export function affectedProductQueryFamilies(
  scope: ClientScope,
  updated: Pick<ProductView["terms"], "scopes">,
  previous: ProductView["terms"] | undefined,
  knownCenterIds: readonly string[],
  productId?: string,
) {
  const scopes = [...updated.scopes, ...(previous?.scopes ?? [])];
  const centerIds = new Set([scope.centerId]);
  const orgWide = scopes.some((row) => row.scope_kind.startsWith("organization_"));
  if (orgWide) for (const centerId of knownCenterIds) centerIds.add(centerId);
  for (const row of scopes) if (row.center_id) centerIds.add(row.center_id);
  return [...centerIds].flatMap((centerId) => [
    productsKeys.management({ ...scope, centerId }),
    ["profile-catalog", scope.accountId, scope.orgId, centerId],
    ["business-product-scope", scope.accountId, scope.orgId, centerId],
    productsKeys.eventChoices({ ...scope, centerId }),
    ...(productId
      ? [[...productsKeys.history({ ...scope, centerId }, productId), "versions"]]
      : []),
  ]);
}

export async function invalidateProductSalesViews(
  queries: QueryClient,
  scope: ClientScope,
  productIds?: readonly string[],
) {
  const histories = queries
    .getQueryCache()
    .findAll({ queryKey: ["product-history", scope.accountId, scope.orgId, scope.centerId] })
    .filter(
      ({ queryKey }) =>
        queryKey[5] === "sales" &&
        (!productIds || (typeof queryKey[4] === "string" && productIds.includes(queryKey[4]))),
    )
    .map(({ queryKey }) => queryKey);
  await invalidateCachedFamilies(queries, [productsKeys.management(scope), ...histories]);
}
