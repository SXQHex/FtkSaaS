import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";

export const peopleKeys = {
  center: (scope: ClientScope) => ["people", scope.accountId, scope.orgId, scope.centerId] as const,
  picker: (scope: ClientScope) =>
    ["lead-people", scope.accountId, scope.orgId, scope.centerId] as const,
};

export function invalidatePeoplePages(queries: QueryClient, scope: ClientScope) {
  // All filters and cursor pages share this prefix. The visible page is reread
  // explicitly only after the native operation's result is confirmed.
  return invalidateCachedFamilies(queries, [peopleKeys.center(scope), peopleKeys.picker(scope)]);
}
