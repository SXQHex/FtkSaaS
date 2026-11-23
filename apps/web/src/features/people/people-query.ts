import type { QueryClient, QueryKey } from "@tanstack/react-query";
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

const personDirectories = new Set([
  "people",
  "lead-people",
  "lead-assignees",
  "business-people",
  "business-managers",
  "business-settlement-managers",
  "merge-directory",
  "merge-people",
  "finance-directory",
  "access-accounts",
  "access-invitations",
  "event-detail",
  "event-duty-persons",
  "overview-labels",
  "overview-participants",
  "instructor-session",
  "lesson-requests",
  "schedule-group",
  "schedule-group-people",
  "studio",
  "schedule-sources",
]);

const personInfiniteDirectories = new Set([
  "lead-assignees",
  "business-people",
  "business-managers",
  "business-settlement-managers",
  "earnings-instructor-catalog",
]);

export function isPersonInfiniteDirectory(key: QueryKey) {
  return typeof key[0] === "string" && personInfiniteDirectories.has(key[0]);
}

export function readsPersonIdentity(key: QueryKey, scope: ClientScope, personId?: string) {
  const [family, accountOrScope, org, , subject] = key;
  if (accountOrScope === scope.accountId && org === scope.orgId) {
    if (family === "profile-person" || family === "person-editor")
      return !personId || subject === personId;
    if (family === "product-history") return key[5] === "sales";
    if (family === "event-choices") return subject === "people";
    if (family === "lesson-request-editor") return key[5] === "instructors";
    if (family === "member-private-lessons") return key[5] === "instructors";
    if (family === "session-detail") {
      const source = key[5];
      return (
        source === "search" ||
        source === "participants" ||
        source === "header" ||
        source === "instructors" ||
        ((source === "booking" || source === "waitlist") && key[6] === "people")
      );
    }
    return typeof family === "string" && personDirectories.has(family);
  }
  if (
    !accountOrScope ||
    typeof accountOrScope !== "object" ||
    !("accountId" in accountOrScope && "orgId" in accountOrScope) ||
    accountOrScope.accountId !== scope.accountId ||
    accountOrScope.orgId !== scope.orgId
  )
    return false;

  if (family === "earnings-instructor-catalog") return true;
  if (family === "business-merge-suggestions") return true;
  if (family === "earnings-directory") return !personId || !key[3] || key[3] === personId;
  if (family === "settings-team-directory" || family === "settings-team-picker") return true;
  return (
    family === "report-view" &&
    (key[3] === "instructor_balances" || (key[3] === "collection_breakdown" && key[4] === "person"))
  );
}

export async function invalidatePersonIdentityViews(
  queries: QueryClient,
  scope: ClientScope,
  personId: string,
) {
  const families = queries
    .getQueryCache()
    .findAll({ predicate: ({ queryKey }) => readsPersonIdentity(queryKey, scope, personId) })
    .map(({ queryKey }) => queryKey);
  if (families.length)
    await invalidateCachedFamilies(queries, families, families.filter(isPersonInfiniteDirectory));
}
