import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { invalidateAndReadFirstPage } from "../../lib/cache-invalidation";
import { scheduleCacheKeys } from "../schedule/schedule-cache";
import { sessionDetailKeys } from "../session-detail/session-detail-query";
import { readStudioResource, readStudioRooms, type StudioScope } from "./studio";

export function studioRoomsQuery(scope: StudioScope) {
  return queryOptions({
    queryKey: ["studio-rooms", scope.accountId, scope.orgId, scope.centerId],
    queryFn: (context) => readStudioRooms(scope, context),
    retry: false,
  });
}

export function studioRoomQuery(queries: QueryClient, scope: StudioScope, roomId?: string) {
  const directory = studioRoomsQuery(scope);
  const source = queries.getQueryState(directory.queryKey);
  const initial = source?.status === "success" && !source.isInvalidated ? source : undefined;
  return queryOptions({
    queryKey: [...directory.queryKey, roomId],
    queryFn: (context) => readStudioResource(scope, "room", roomId!, context),
    initialData: initial?.data?.find((room) => room.id === roomId),
    initialDataUpdatedAt: initial?.dataUpdatedAt,
    retry: false,
  });
}

export async function refreshStudioRooms(queries: QueryClient, scope: StudioScope) {
  const key = studioRoomsQuery(scope).queryKey;
  const tenant = [scope.accountId, scope.orgId, scope.centerId] as const;
  const sessionRooms = queries
    .getQueryCache()
    .findAll({
      queryKey: sessionDetailKeys.center(scope),
      predicate: ({ queryKey }) => queryKey[5] === "rooms",
    })
    .map(({ queryKey }) => queryKey);
  return invalidateAndReadFirstPage({
    queries,
    families: [
      key,
      ["studio", ...tenant],
      ["schedule-sources", ...tenant],
      ["settings-subscription", scope.accountId, scope.orgId],
      scheduleCacheKeys.instructorCalendar(scope),
      scheduleCacheKeys.instructorSession(scope),
      scheduleCacheKeys.overviewLabels(scope),
      ["member-classes", ...tenant],
      ["member-reservations", ...tenant],
      ...sessionRooms,
    ],
    firstPageKey: key,
    readFirstPage: ({ signal }) => readStudioRooms(scope, undefined, signal),
  });
}
