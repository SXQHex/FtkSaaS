import { queryOptions, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { readWorkspace } from "./workspace";
import { verifiedWorkspaceAccount } from "../auth/account-query";

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

// The shell owns the live fetch. Feature screens only observe the same query
// without initiating their own background read when disabled.
export function useWorkspaceQuery(
  accountId: string,
  organizationId?: string,
  enabled = true,
) {
  const queries = useQueryClient();
  return useQuery({ ...workspaceQuery(queries, accountId, organizationId), enabled });
}
