import { useCallback, useContext, useSyncExternalStore } from "react";
import {
  notifyManager,
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { readWorkspace } from "./workspace";
import { verifiedWorkspaceAccount } from "../auth/account-query";
import { PrivateSessionRevision } from "../auth/private-session-revision";

type Workspace = Awaited<ReturnType<typeof readWorkspace>>;

export const workspaceKeys = {
  all: () => ["workspace"] as const,
  account: (accountId: string) => ["workspace", accountId] as const,
  projection: (accountId: string, organizationId?: string) =>
    ["workspace", accountId, organizationId ?? null] as const,
};

// All organization variants, including auto-selection (null), become stale
// when actor roles, center access, or subscription information changes.
export function invalidateWorkspace(
  queries: QueryClient,
  accountId: string,
  options?: { throwOnError?: boolean },
) {
  return queries.invalidateQueries({ queryKey: workspaceKeys.account(accountId) }, options);
}

export function workspaceQuery(queries: QueryClient, accountId: string, organizationId?: string) {
  const automatic = organizationId
    ? queries.getQueryState<Workspace>(workspaceKeys.projection(accountId))
    : undefined;
  // Reuse the same resolved organization without restarting the existing freshness clock.
  // Invalidated, failed, other-account and other-organization results cannot seed this query.
  const initial =
    automatic?.status === "success" &&
    !automatic.isInvalidated &&
    automatic.data?.selected?.id === organizationId
      ? automatic
      : undefined;
  return queryOptions({
    queryKey: workspaceKeys.projection(accountId, organizationId),
    queryFn: ({ signal }) =>
      readWorkspace(
        accountId,
        organizationId,
        (session) => verifiedWorkspaceAccount(queries, session.user.id),
        signal,
      ),
    initialData: initial?.data,
    initialDataUpdatedAt: initial?.dataUpdatedAt,
    retry: false,
    // A loader prefetch error is shown by the workspace shell, not retried on mount.
    retryOnMount: false,
  });
}

// Explicit refreshes use the same cancellable Query as the shell. Bypass the
// freshness window without publishing a standalone readback into the cache.
export function refreshWorkspace(queries: QueryClient, accountId: string, organizationId?: string) {
  return queries.query({ ...workspaceQuery(queries, accountId, organizationId), staleTime: 0 });
}

// The shell owns the live fetch. Feature screens only observe the same query
// without initiating their own background read when disabled.
export function useWorkspaceQuery(accountId: string, organizationId?: string, enabled = true) {
  // Same-actor handoff evicts the underlying Query while views stay mounted.
  // Rebind the observer to the replacement even if the route and props match.
  useContext(PrivateSessionRevision);
  const queries = useQueryClient();
  const options = queries.defaultQueryOptions({
    ...workspaceQuery(queries, accountId, organizationId),
    enabled,
  });
  const workspace = useQuery(options);
  const cache = queries.getQueryCache();
  const { queryHash } = options;
  // A concurrent access check can evict the workspace again in the same
  // revision. Observe replacement of the entry and let useQuery own the data.
  useSyncExternalStore(
    useCallback(
      (notify: () => void) => {
        const onRemoval = notifyManager.batchCalls(notify);
        return cache.subscribe((event) => {
          if (event.type === "removed" && event.query.queryHash === queryHash) onRemoval();
        });
      },
      [cache, queryHash],
    ),
    () => cache.get(queryHash),
  );
  return workspace;
}
