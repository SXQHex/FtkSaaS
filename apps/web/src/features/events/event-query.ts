import { v7 as uuidv7 } from "uuid";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { BackendError, queryBackendRead } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
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

let activeDutyReads = 0;
const waitingDutyReads: (() => void)[] = [];

async function withDutyReadSlot<T>(read: () => Promise<T>) {
  if (activeDutyReads < 4) activeDutyReads += 1;
  else await new Promise<void>((resolve) => waitingDutyReads.push(resolve));
  try {
    return await read();
  } finally {
    // Transfer the slot before a new query can start ahead of the waiting reads.
    const next = waitingDutyReads.shift();
    if (next) next();
    else activeDutyReads -= 1;
  }
}

export function eventDutyNameQuery(scope: ClientScope, personId: string) {
  return queryOptions({
    queryKey: ["event-duty-persons", scope.accountId, scope.orgId, scope.centerId, personId],
    queryFn: (readContext) => {
      const { signal } = readContext;
      return withDutyReadSlot(async () => {
        signal.throwIfAborted();
        const backend = await scopedBackend(scope, undefined, readContext);
        try {
          const person = await queryBackendRead(
            backend,
            "person_get_v1",
            {
              client_api_version: 1,
              request_id: uuidv7(),
              org_id: scope.orgId,
              person_id: personId,
            },
            signal,
          );
          if (person.id !== personId) throw new Error("EVENT_PERSON_UNAVAILABLE");
          return person.display_name;
        } catch (error) {
          if (error instanceof BackendError && ["FORBIDDEN", "NOT_FOUND"].includes(error.code))
            return null;
          throw error;
        }
      });
    },
    retry: false,
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
