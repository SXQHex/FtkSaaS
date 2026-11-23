import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";
import type { ClientScope } from "../../lib/scoped-backend";
import { invalidateEarningsViews } from "../earnings/earnings-query";
import { reportCollectionFamilies } from "../reports/reports-query";
import { productsKeys } from "../products/products-query";
import { readDetailedEvent } from "./event-registration-read";

export function eventDetailKey(scope: ClientScope, eventId: string) {
  return ["event-detail", scope.accountId, scope.orgId, scope.centerId, eventId] as const;
}

export function eventDetailQuery(scope: ClientScope, eventId: string) {
  return queryOptions({
    queryKey: eventDetailKey(scope, eventId),
    queryFn: (readContext) => readDetailedEvent(scope, eventId, readContext),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export type EventWriteEffects = {
  finance?: boolean;
  earnings?: boolean;
  productRights?: boolean;
  personId?: string;
  detailVerified?: boolean;
};

export async function invalidateEventViews(
  queries: QueryClient,
  scope: ClientScope,
  eventId: string,
  effects: EventWriteEffects = {},
) {
  const tenant = [scope.accountId, scope.orgId, scope.centerId] as const;
  const families: (readonly unknown[])[] = [
    ["events", ...tenant],
    ["schedule-range", ...tenant],
    ["event-registration-payment", ...tenant, eventId],
    ["registered-event-payment", ...tenant, eventId],
  ];
  if (!effects.detailVerified) families.push(eventDetailKey(scope, eventId));
  if (effects.productRights) families.push(productsKeys.management(scope));
  if (effects.finance) {
    families.push(["finance-directory", ...tenant], ["people", ...tenant]);
    const subject = effects.personId ? [...tenant, effects.personId] : tenant;
    for (const name of [
      "finance-directory-credit-debts",
      "finance",
      "profile-person",
      "profile-rights",
      "profile-ledger",
      "member-entitlements",
      "event-registration-rights",
    ])
      families.push([name, ...subject]);
    families.push(...reportCollectionFamilies(scope));
  }
  await Promise.all([
    invalidateCachedFamilies(queries, families),
    ...(effects.earnings ? [invalidateEarningsViews(queries, scope)] : []),
  ]);
}
