import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";

export const memberPrivateLessonKeys = {
  person: (scope: ClientScope, personId: string) =>
    ["member-private-lessons", scope.accountId, scope.orgId, scope.centerId, personId] as const,
};

export function invalidateMemberPrivateLessonLists(
  queries: QueryClient,
  scope: ClientScope,
  personId: string,
) {
  return invalidateCachedFamilies(queries, [
    [...memberPrivateLessonKeys.person(scope, personId), "list"],
  ]);
}
