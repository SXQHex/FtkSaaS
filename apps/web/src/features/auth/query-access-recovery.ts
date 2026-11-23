import { type QueryClient, type QueryKey } from "@tanstack/react-query";
import type { readWorkspace } from "../workspace/workspace";
import { workspaceKeys, workspaceQuery } from "../workspace/workspace-query";
import { accountQueryKeys } from "./account-query";
import { BackendError } from "../../lib/backend";

type Workspace = Awaited<ReturnType<typeof readWorkspace>>;
type AccessFailure = "session" | "actor" | "permission";

export function classifyAccessFailure(error: unknown): AccessFailure | undefined {
  if (error instanceof BackendError) {
    if (error.code === "AUTH_REQUIRED" || error.code === "SESSION_REVOKED") return "session";
    if (error.code === "FORBIDDEN") return "permission";
  }
  if (error instanceof Error) {
    if (error.message === "AUTH_REQUIRED") return "session";
    if (error.message === "ACCOUNT_CHANGED") return "actor";
  }
  return undefined;
}

// A role-directory denial is not necessarily loss of the session or of all
// workspace access. Compare native authority before evicting other queries.
export function workspaceAuthority(view: Workspace | undefined): string | undefined {
  if (!view) return undefined;
  const selected = view.selected;
  return JSON.stringify({
    organization: selected?.id ?? null,
    accessMode: selected?.access_mode ?? null,
    ownManagement: selected?.self_management_scope ?? null,
    person: selected?.self_context?.person_id ?? null,
    ownCenters:
      selected?.self_context?.centers
        .map((row) => JSON.stringify([row.center_id, row.student, row.instructor, row.assistant]))
        .sort() ?? [],
    centers: view.centers
      .map((row) => JSON.stringify([row.id, row.accessible, row.state]))
      .sort(),
    roles: view.roles
      .map((row) =>
        JSON.stringify([
          row.person_id,
          row.role,
          row.scope_center_id,
          row.state,
          row.account_access_granted,
        ]),
      )
      .sort(),
  });
}

function knownAccountId(queries: QueryClient): string | undefined {
  const ids = new Set(
    queries
      .getQueriesData<{ id: string }>({ queryKey: accountQueryKeys.all() })
      .map(([, account]) => account?.id)
      .filter((id): id is string => typeof id === "string"),
  );
  // A different native actor is handled by the auth lifecycle, not by a
  // best-guess permission refresh against another account.
  return ids.size === 1 ? [...ids][0] : undefined;
}

function keyHasOrganization(key: QueryKey, orgId: string): boolean {
  return key.some(
    (part) =>
      part === orgId ||
      (part !== null &&
        typeof part === "object" &&
        "orgId" in part &&
        part.orgId === orgId),
  );
}

function activeWorkspace(queries: QueryClient, accountId: string, failedKey: QueryKey) {
  const candidates = queries
    .getQueriesData<Workspace>({ queryKey: workspaceKeys.account(accountId) })
    .filter(([, view]) => Boolean(view?.selected?.id));
  const matched =
    candidates.find(([, view]) =>
      view?.selected?.id ? keyHasOrganization(failedKey, view.selected.id) : false,
    ) ?? candidates[0];
  return matched?.[1];
}

export interface AccessRecoveryActions {
  onChecking: (checking: boolean) => void;
  invalidateRoute: () => Promise<unknown>;
  showLogin: () => Promise<unknown>;
}

export async function reconcileQueryAccessFailure(
  queries: QueryClient,
  failedKey: QueryKey,
  failure: unknown,
  actions: AccessRecoveryActions,
) {
  const kind = classifyAccessFailure(failure);
  if (!kind) return;
  if (kind !== "permission") {
    // Cancel late private reads as well as removing successfully cached ones.
    queries.clear();
    if (kind === "session") await actions.showLogin();
    else await actions.invalidateRoute();
    return;
  }

  const accountId = knownAccountId(queries);
  const previous = accountId ? activeWorkspace(queries, accountId, failedKey) : undefined;
  if (!accountId || !previous?.selected?.id) {
    // No verified authority to compare against: fail closed rather than retain
    // an arbitrary older actor's private Query data.
    queries.clear();
    await actions.invalidateRoute();
    return;
  }

  const orgId = previous.selected.id;
  let current: Workspace;
  try {
    // An older in-flight workspace response must not defeat this permission check.
    await queries.cancelQueries({ queryKey: workspaceKeys.account(accountId) });
    // Force an authoritative read even when this workspace projection is still
    // within its regular Query freshness window.
    current = await queries.fetchQuery({
      ...workspaceQuery(queries, accountId, orgId),
      staleTime: 0,
    });
  } catch (error) {
    queries.clear();
    if (classifyAccessFailure(error) === "session") await actions.showLogin();
    else await actions.invalidateRoute();
    return;
  }
  if (workspaceAuthority(previous) === workspaceAuthority(current)) return;

  // Actual role/center loss: evict every private continuation and in-flight
  // read, not only the Query that happened to return FORBIDDEN first.
  queries.clear();
  queries.setQueryData(workspaceKeys.projection(accountId, orgId), current);
  await actions.invalidateRoute();
}

function isWorkspaceProjection(key: QueryKey) {
  return (
    key.length === 3 &&
    key[0] === "workspace" &&
    typeof key[1] === "string" &&
    (key[2] === null || typeof key[2] === "string")
  );
}

export function observeQueryAccessFailures(queries: QueryClient, actions: AccessRecoveryActions) {
  const handled = new Set<string>();
  const authorities = new Map<string, { fingerprint: string; selectedId?: string }>();
  const cache = queries.getQueryCache();
  const remember = (hash: string, view: Workspace | undefined) => {
    const fingerprint = workspaceAuthority(view);
    if (!fingerprint) return;
    authorities.set(hash, { fingerprint, selectedId: view?.selected?.id });
  };
  for (const query of cache.getAll()) {
    if (isWorkspaceProjection(query.queryKey)) {
      remember(query.queryHash, query.state.data as Workspace | undefined);
    }
  }

  let checking = false;
  const run = (work: () => Promise<unknown>) => {
    if (checking) return;
    checking = true;
    actions.onChecking(true);
    void work()
      .catch(() => {
        // Never expose a stale private screen when route reconciliation fails.
        queries.clear();
        return actions.invalidateRoute();
      })
      .finally(() => {
        checking = false;
        actions.onChecking(false);
      });
  };

  return cache.subscribe((event) => {
    if (event.type === "removed") {
      authorities.delete(event.query.queryHash);
      handled.delete(event.query.queryHash);
      return;
    }
    if (event.type !== "updated") return;
    const query = event.query;
    if (event.action.type === "success") {
      handled.delete(query.queryHash);
      if (!isWorkspaceProjection(query.queryKey)) return;
      const current = query.state.data as Workspace | undefined;
      const previous = authorities.get(query.queryHash);
      remember(query.queryHash, current);
      // React Query's manual cache projections are not proof of a new remote
      // authority decision. Only a native workspace read can revoke access.
      if (
        !checking &&
        !event.action.manual &&
        previous?.selectedId &&
        previous.fingerprint !== workspaceAuthority(current) &&
        current
      ) {
        run(async () => {
          // An externally revoked role must invalidate every scoped feature,
          // including cached history pages and still pending responses.
          queries.clear();
          queries.setQueryData(query.queryKey, current);
          await actions.invalidateRoute();
        });
      }
      return;
    }
    if (event.action.type !== "error" || checking) return;
    if (!classifyAccessFailure(query.state.error)) return;
    if (handled.has(query.queryHash)) return;
    handled.add(query.queryHash);
    run(() =>
      reconcileQueryAccessFailure(queries, query.queryKey, query.state.error, actions),
    );
  });
}
