import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { ProductView } from "@ftksaas/api-contracts";
import { expect, it, vi } from "vitest";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { affectedProductQueryFamilies } from "./products-query";

const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
const centerB = { ...scope, centerId: "center-b" };
const centerC = { ...scope, centerId: "center-c" };
const foreign = { ...scope, orgId: "org-b" };
const catalog = (s: typeof scope) =>
  ["profile-catalog", s.accountId, s.orgId, s.centerId] as const;
const terms = (centerId: string): ProductView["terms"] => ({
  name: "Sample",
  kind: "credits",
  booking_mode: "priority",
  credits: 8,
  price_minor: "10000",
  currency: "TRY",
  refund: { method: "none" },
  freeze: { enabled: false, extends_validity: false },
  quota: null,
  scopes: [{
    scope_kind: "center_all_disciplines",
    center_id: centerId,
    discipline_id: null,
    usage_targets: ["lesson"],
  }],
});

it("stales member purchase, management and business catalogs for old and new product centers", async () => {
  const queries = new QueryClient();
  const affected = [
    ["products-management", scope.accountId, scope.orgId, scope.centerId, "on", "cursor-2"],
    ["products-management", centerB.accountId, centerB.orgId, centerB.centerId, "on"],
    catalog(scope),
    catalog(centerB),
    ["business-product-scope", scope.accountId, scope.orgId, scope.centerId],
  ];
  const unrelated = [catalog(centerC), catalog(foreign)];
  for (const key of [...affected, ...unrelated])
    queries.setQueryData(key, { revision: "before" });

  const read = vi.fn(async () => ({ revision: "after" }));
  const stop = new QueryObserver(queries, {
    queryKey: catalog(centerB),
    queryFn: read,
    staleTime: Infinity,
  }).subscribe(() => {});
  await invalidateCachedFamilies(
    queries,
    affectedProductQueryFamilies(scope, terms("center-b"), terms("center-a"), [
      centerB.centerId,
      centerC.centerId,
    ]),
  );
  for (const key of affected) expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  for (const key of unrelated) expect(queries.getQueryState(key)?.isInvalidated).toBe(false);
  expect(read).not.toHaveBeenCalled();

  await queries.fetchQuery({
    queryKey: catalog(centerB),
    queryFn: read,
    staleTime: Infinity,
  });
  expect(read).toHaveBeenCalledTimes(1);
  stop();
});

it("organization-wide product scopes update the known centers without crossing organizations", () => {
  const orgWide = terms(scope.centerId);
  orgWide.scopes = [{
    ...orgWide.scopes[0]!,
    scope_kind: "organization_all_disciplines",
    center_id: null,
  }];
  const families = affectedProductQueryFamilies(scope, orgWide, undefined, [
    centerB.centerId,
    centerC.centerId,
  ]);
  expect(families).toContainEqual(catalog(scope));
  expect(families).toContainEqual(catalog(centerB));
  expect(families).toContainEqual(catalog(centerC));
  expect(families.every((key) => key[2] === scope.orgId)).toBe(true);
});
