import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";

export const memberReservationKeys = {
  person: (scope: ClientScope, personId: string) =>
    ["member-reservations", scope.accountId, scope.orgId, scope.centerId, personId] as const,
};

export async function invalidateMemberReservationViews(
  queries: QueryClient,
  scope: ClientScope,
  personId: string,
) {
  const tenant = [scope.accountId, scope.orgId, scope.centerId] as const;
  // The current command's required result read is separate. Mark every other
  // page and dependent domain stale without redispatching a native writer.
  await Promise.all(
    [
      memberReservationKeys.person(scope, personId),
      ["member-classes", ...tenant, personId],
      ["member-entitlements", ...tenant, personId],
      ["profile-reservations", ...tenant, personId],
      ["session-detail", ...tenant],
      ["schedule-range", ...tenant],
      ["people", ...tenant],
    ].map((queryKey) => queries.invalidateQueries({ queryKey, refetchType: "none" })),
  );
}
