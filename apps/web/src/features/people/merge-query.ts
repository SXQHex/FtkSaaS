import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";

// Merge aliases can affect records in other centers of the same organization.
// Do not touch another actor/organization, or unrelated query families.
const affectedFamilies = new Set([
  "people",
  "merge-directory",
  "merge-approvals",
  "merge-people",
  "profile-person",
  "profile-rights",
  "profile-ledger",
  "profile-reservations",
  "profile-negative-limit",
  "finance",
  "person-editor",
]);

export async function invalidateMergeViews(queries: QueryClient, scope: ClientScope) {
  const affected = (queryKey: QueryKey) =>
    queryKey[1] === scope.accountId &&
    queryKey[2] === scope.orgId &&
    typeof queryKey[0] === "string" &&
    affectedFamilies.has(queryKey[0]);

  // Prevent pre-write reads from winning a race against the mandatory native
  // first-page readback. Existing cursor pages stay cached but stale.
  await queries.cancelQueries({ predicate: ({ queryKey }) => affected(queryKey) });
  await queries.invalidateQueries({
    predicate: ({ queryKey }) => affected(queryKey),
    refetchType: "none",
  });
}
