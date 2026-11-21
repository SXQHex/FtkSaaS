import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { readWorkspace } from "./workspace";
import { verifiedWorkspaceAccount } from "../auth/account-query";

type Workspace = Awaited<ReturnType<typeof readWorkspace>>;

export function workspaceQuery(queries: QueryClient, accountId: string, organizationId?: string) {
  const automatic = organizationId
    ? queries.getQueryState<Workspace>(["workspace", accountId, null])
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
    queryKey: ["workspace", accountId, organizationId ?? null],
    queryFn: () =>
      readWorkspace(accountId, organizationId, (session) =>
        verifiedWorkspaceAccount(queries, session.user.id),
      ),
    initialData: initial?.data,
    initialDataUpdatedAt: initial?.dataUpdatedAt,
    retry: false,
  });
}
