import { capturePrivateReadback, retainFirstInfinitePage } from "../../lib/cache-invalidation";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { isPersonInfiniteDirectory, readsPersonIdentity } from "./people-query";

// Merge aliases can affect records in other centers of the same organization.
// Do not touch another actor/organization, or unrelated query families.
const aliasFamilies = new Set([
  "profile-rights",
  "profile-ledger",
  "profile-reservations",
  "profile-negative-limit",
  "finance",
  "finance-directory-credit-debts",
  "member-entitlements",
  "booking-rights",
  "products-management",
]);

export async function invalidateMergeViews(
  queries: QueryClient,
  scope: ClientScope,
  aliasesChanged = true,
) {
  const assertCurrent = capturePrivateReadback(queries);
  const affected = (queryKey: QueryKey) => {
    const [family, accountId, orgId] = queryKey;
    if (family === "business-merge-suggestions") return readsPersonIdentity(queryKey, scope);
    if (aliasesChanged && readsPersonIdentity(queryKey, scope)) return true;
    return (
      accountId === scope.accountId &&
      orgId === scope.orgId &&
      (family === "merge-directory" ||
        family === "merge-approvals" ||
        (aliasesChanged && typeof family === "string" && aliasFamilies.has(family)))
    );
  };
  const filters = { predicate: ({ queryKey }: { queryKey: QueryKey }) => affected(queryKey) };

  // Prevent pre-write reads from winning a race against the mandatory native
  // first-page readback. Existing cursor pages stay cached but stale.
  await queries.cancelQueries(filters);
  assertCurrent();
  for (const { queryKey } of queries.getQueryCache().findAll(filters)) {
    if (isPersonInfiniteDirectory(queryKey)) retainFirstInfinitePage(queries, queryKey);
  }
  await queries.invalidateQueries({ ...filters, refetchType: "none" });
}
