import { type QueryClient, type QueryKey } from "@tanstack/react-query";
import { readWorkspace } from "../workspace/workspace";
import { workspaceKeys } from "../workspace/workspace-query";
import { accountQueryKeys, verifiedWorkspaceAccount } from "./account-query";
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
    centers: view.centers.map((row) => JSON.stringify([row.id, row.accessible, row.state])).sort(),
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

// Detect *lost* native capabilities, not any workspace revision. Adding a
// center or gaining a role must never discard a pending command's receipt.
export function workspaceAccessLost(before: Workspace | undefined, after: Workspace | undefined) {
  if (!before?.selected) return false;
  const previous = before.selected;
  const current = after?.selected;
  if (!current || current.id !== previous.id) return true;
  if (
    previous.self_context?.person_id &&
    previous.self_context.person_id !== current.self_context?.person_id
  )
    return true;

  const oldManagement = previous.self_management_scope;
  const newManagement = current.self_management_scope;
  if (oldManagement?.owner && !newManagement?.owner) return true;
  if (oldManagement?.org_manager && !newManagement?.org_manager) return true;
  if (
    oldManagement?.managed_center_ids?.some(
      (id) => !newManagement?.managed_center_ids?.includes(id),
    )
  )
    return true;

  if (
    previous.self_context?.centers.some((center) => {
      const fresh = current.self_context?.centers.find(
        (row) => row.center_id === center.center_id,
      );
      return (
        (center.student && !fresh?.student) ||
        (center.instructor && !fresh?.instructor) ||
        (center.assistant && !fresh?.assistant)
      );
    })
  )
    return true;

  if (
    before.centers.some(
      (center) =>
        center.accessible &&
        !after?.centers.some((fresh) => fresh.id === center.id && fresh.accessible),
    )
  )
    return true;

  return before.roles.some(
    (role) =>
      role.state === "active" &&
      role.account_access_granted !== false &&
      !after?.roles.some(
        (fresh) =>
          fresh.person_id === role.person_id &&
          fresh.role === role.role &&
          fresh.scope_center_id === role.scope_center_id &&
          fresh.state === "active" &&
          fresh.account_access_granted !== false,
      ),
  );
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
      (part !== null && typeof part === "object" && "orgId" in part && part.orgId === orgId),
  );
}

function activeWorkspace(queries: QueryClient, accountId: string, failedKey: QueryKey) {
  const candidates = queries
    .getQueriesData<Workspace>({ queryKey: workspaceKeys.account(accountId) })
    .filter(([, view]) => Boolean(view?.selected?.id));
  // A platform/actor-only denial has no organization scope. Never guess one
  // from an unrelated workspace projection or interpret it as a global logout.
  const matched = candidates.find(([, view]) =>
    view?.selected?.id ? keyHasOrganization(failedKey, view.selected.id) : false,
  );
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
    // FORBIDDEN is an operation-specific denial unless an organization
    // authority actually changed. Preserve platform/user error screens.
    return;
  }

  const orgId = previous.selected.id;
  let current: Workspace;
  try {
    // An independent native recheck cannot reuse a cached Query success or
    // turn a denied feature query into another privileged cache read.
    current = await readWorkspace(accountId, orgId, (session) =>
      verifiedWorkspaceAccount(queries, session.user.id),
    );
  } catch (error) {
    queries.clear();
    if (classifyAccessFailure(error) === "session") await actions.showLogin();
    else await actions.invalidateRoute();
    return;
  }
  if (!workspaceAccessLost(previous, current)) {
    // A feature-specific FORBIDDEN (or newly granted capabilities) must not
    // evict unrelated authorized data or a pending native command.
    return;
  }

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
  const authorities = new Map<string, { fingerprint: string; view: Workspace }>();
  const cache = queries.getQueryCache();
  const remember = (hash: string, view: Workspace | undefined) => {
    const fingerprint = workspaceAuthority(view);
    if (!fingerprint) return;
    if (view) authorities.set(hash, { fingerprint, view });
  };
  for (const query of cache.getAll()) {
    if (isWorkspaceProjection(query.queryKey)) {
      remember(query.queryHash, query.state.data as Workspace | undefined);
    }
  }

  let checking = false;
  let terminated = false;
  // Once native identity is rejected, no queued workspace read may restore it.
  const safeActions: AccessRecoveryActions = {
    ...actions,
    showLogin: async () => {
      terminated = true;
      await actions.showLogin();
    },
  };
  // Concurrent feature failures must not disappear behind the first
  // permission recheck: a later SESSION_REVOKED outranks a benign FORBIDDEN.
  const pending = new Map<string, () => Promise<unknown>>();
  const run = (id: string, work: () => Promise<unknown>) => {
    if (checking) {
      pending.set(id, work);
      return;
    }
    checking = true;
    actions.onChecking(true);
    const execute = async (next: () => Promise<unknown>) => {
      try {
        await next();
      } catch {
        // Never expose a stale private screen when route reconciliation fails.
        queries.clear();
        await actions.invalidateRoute();
      }
    };
    void (async () => {
      await execute(work);
      while (pending.size) {
        const next = pending.entries().next().value;
        if (!next) break;
        pending.delete(next[0]);
        await execute(next[1]);
      }
    })()
      .catch(() => {
        queries.clear();
        return safeActions.showLogin();
      })
      .finally(() => {
        checking = false;
        actions.onChecking(false);
      });
  };

  return cache.subscribe((event) => {
    if (event.type === "added") {
      // A selected workspace can be created with automatic-scope initialData.
      // Capture that previous authority before its first real backend success.
      if (isWorkspaceProjection(event.query.queryKey)) {
        remember(event.query.queryHash, event.query.state.data as Workspace | undefined);
      }
      return;
    }
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
        !terminated &&
        !event.action.manual &&
        previous?.view.selected?.id &&
        previous.fingerprint !== workspaceAuthority(current) &&
        workspaceAccessLost(previous.view, current) &&
        current
      ) {
        run(`workspace:${query.queryHash}`, async () => {
          // A queued role refresh must never rehydrate an actor after logout.
          if (terminated || !knownAccountId(queries)) return;
          // An externally revoked role must invalidate every scoped feature,
          // including cached history pages and still pending responses.
          queries.clear();
          queries.setQueryData(query.queryKey, current);
          await actions.invalidateRoute();
        });
      }
      return;
    }
    if (event.action.type !== "error") return;
    const kind = classifyAccessFailure(query.state.error);
    if (!kind) return;
    if (kind !== "permission") terminated = true;
    else if (terminated) return;
    if (handled.has(query.queryHash)) return;
    handled.add(query.queryHash);
    const key = query.queryKey;
    const error = query.state.error;
    run(`query:${query.queryHash}`, () => {
      // Another concurrent revocation may already have purged this feature.
      // Still process terminal session/actor errors after their Query vanishes.
      if (kind === "permission" && (terminated || !cache.find({ queryKey: key, exact: true })))
        return Promise.resolve();
      return reconcileQueryAccessFailure(queries, key, error, safeActions);
    });
  });
}
