import type { BookingMode } from "@ftksaas/api-contracts";
import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";

export const memberReservationKeys = {
  person: (scope: ClientScope, personId: string) =>
    ["member-reservations", scope.accountId, scope.orgId, scope.centerId, personId] as const,
  bookingRights: (scope: ClientScope, personId: string, sessionId: string, mode: BookingMode) =>
    [...memberReservationKeys.bookingRightsForPerson(scope, personId), sessionId, mode] as const,
  bookingRightsForPerson: (scope: ClientScope, personId: string) =>
    ["booking-rights", scope.accountId, scope.orgId, scope.centerId, personId] as const,
};

export function invalidateMemberReservationViews(
  queries: QueryClient,
  scope: ClientScope,
  personId: string,
) {
  const tenant = [scope.accountId, scope.orgId, scope.centerId] as const;
  // The current command's required result read is separate. Cancel only older
  // affected readers and leave the native writer and receipt untouched.
  return invalidateCachedFamilies(queries, [
    memberReservationKeys.person(scope, personId),
    memberReservationKeys.bookingRightsForPerson(scope, personId),
    ["member-classes", ...tenant, personId],
    ["member-entitlements", ...tenant, personId],
    ["profile-reservations", ...tenant, personId],
    ["session-detail", ...tenant],
    ["schedule-range", ...tenant],
    ["instructor-calendar", ...tenant],
    ["instructor-today-attendance", ...tenant],
    ["people", ...tenant],
  ]);
}
