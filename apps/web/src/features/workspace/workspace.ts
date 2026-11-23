import { v7 as uuidv7 } from "uuid";
import type { Session } from "@supabase/supabase-js";
import { BackendError, createBackend } from "../../lib/backend";
import { getSupabaseClient } from "../../lib/supabase";
import { sameNativeSession } from "../auth/native-session-id";
import type { OrganizationView, CenterView, RoleView } from "@ftksaas/api-contracts";

export async function readWorkspace(
  accountId: string,
  organizationId?: string,
  readVerifiedAccount?: (session: Session) => Promise<{ id: string }>,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("AUTH_REQUIRED");
  const token = data.session.access_token;
  const backend = createBackend({
    functionsUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backend-v1`,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    getAccessToken: async () => token,
  });
  // Standalone operations still validate with the pinned native bearer.
  // Router/Query callers may reuse this actor's verified account projection.
  const account = readVerifiedAccount
    ? await readVerifiedAccount(data.session)
    : await backend.read(
        "account_get_v1",
        {
          client_api_version: 1,
          request_id: uuidv7(),
        },
        signal,
      );
  signal?.throwIfAborted();
  if (account.id !== accountId) throw new Error("ACCOUNT_CHANGED");
  const organizations: OrganizationView[] = [];
  let cursor: string | undefined;
  do {
    const page = await backend.read(
      "organizations_list_v1",
      {
        client_api_version: 1,
        request_id: uuidv7(),
        include_self_management_scope: true,
        page: { limit: 50, ...(cursor ? { cursor } : {}) },
      },
      signal,
    );
    organizations.push(...page.items);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  const selected = organizationId
    ? organizations.find((org) => org.id === organizationId)
    : organizations.length === 1
      ? organizations[0]
      : undefined;
  const centers: CenterView[] = [],
    roles: RoleView[] = [];
  if (selected) {
    do {
      const page = await backend.read(
        "centers_list_v1",
        {
          client_api_version: 1,
          request_id: uuidv7(),
          org_id: selected.id,
          page: { limit: 50, ...(cursor ? { cursor } : {}) },
        },
        signal,
      );
      centers.push(...page.items.filter((center) => center.accessible));
      cursor = page.next_cursor ?? undefined;
    } while (cursor);
    const personId = selected.self_context?.person_id;
    if (personId) {
      try {
        do {
          const page = await backend.read(
            "roles_list_v1",
            {
              client_api_version: 1,
              request_id: uuidv7(),
              org_id: selected.id,
              person_id: personId,
              page: { limit: 50, ...(cursor ? { cursor } : {}) },
            },
            signal,
          );
          roles.push(...page.items.filter((role) => role.state === "active"));
          cursor = page.next_cursor ?? undefined;
        } while (cursor);
      } catch (error) {
        if (!(error instanceof BackendError)) throw error;
        const ownScopeAvailable =
          selected.self_management_scope !== undefined ||
          selected.self_context?.centers.some(
            (self) =>
              (self.instructor || self.student) &&
              centers.some((center) => center.id === self.center_id),
          );
        if (
          error.code !== "FORBIDDEN" &&
          !(error.code === "PLAN_FEATURE_UNAVAILABLE" && ownScopeAvailable) &&
          !(error.code === "SUBSCRIPTION_NOT_STARTED" && selected.access_mode === "bootstrap")
        )
          throw error;
        // The denied directory contributes no roles. Native own scope remains authoritative.
        roles.length = 0;
      }
    }
  }
  if (readVerifiedAccount) {
    const latest = await getSupabaseClient().auth.getSession();
    if (latest.error) throw latest.error;
    if (!latest.data.session || !sameNativeSession(data.session, latest.data.session))
      throw new Error("ACCOUNT_CHANGED");
  }
  signal?.throwIfAborted();
  return { organizations, selected, centers, roles };
}

type Workspace = Awaited<ReturnType<typeof readWorkspace>>;

function isManagementRole(role: RoleView["role"]) {
  return role === "owner" || role === "org_manager" || role === "center_manager";
}

export function workspaceRoles(view: Workspace | undefined, centerId?: string) {
  if (
    !view?.selected ||
    (centerId && !view.centers.some((center) => center.id === centerId && center.accessible))
  )
    return [];
  const roles = view.roles.flatMap((role) =>
    role.state === "active" &&
    role.person_id === view.selected?.self_context?.person_id &&
    (role.scope_center_id === null || role.scope_center_id === centerId)
      ? [role.role]
      : [],
  );
  const scope = view.selected.self_management_scope;
  if (scope === undefined) return roles;
  // Null is the server's explicit absence of own management scope.
  const result: RoleView["role"][] = roles.filter((role) => !isManagementRole(role));
  if (scope?.owner === true) result.push("owner");
  if (scope?.org_manager === true) result.push("org_manager");
  if (
    centerId &&
    Array.isArray(scope?.managed_center_ids) &&
    scope.managed_center_ids.includes(centerId)
  )
    result.push("center_manager");
  return result;
}

export function hasWorkspaceManagementScope(view: Workspace | undefined, centerId: string) {
  return workspaceRoles(view, centerId).some(isManagementRole);
}
