import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { invalidateAndReadFirstPage } from "../../lib/cache-invalidation";
import { readStudioRooms, type StudioScope } from "./studio";

export function studioRoomsQuery(scope: StudioScope) {
  return queryOptions({
    queryKey: ["studio-rooms", scope.accountId, scope.orgId, scope.centerId],
    queryFn: (context) => readStudioRooms(scope, context),
    retry: false,
  });
}

export async function refreshStudioRooms(queries: QueryClient, scope: StudioScope) {
  const key = studioRoomsQuery(scope).queryKey;
  const tenant = [scope.accountId, scope.orgId, scope.centerId] as const;
  return invalidateAndReadFirstPage({
    queries,
    families: [
      key,
      ["studio", ...tenant],
      ["schedule-sources", ...tenant],
      ["settings-subscription", scope.accountId, scope.orgId],
    ],
    firstPageKey: key,
    readFirstPage: ({ signal }) => readStudioRooms(scope, undefined, signal),
  });
}
