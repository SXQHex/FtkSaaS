import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { Session } from "@supabase/supabase-js";
import { BackendError, getBackend } from "../../lib/backend";
import { getSupabaseClient } from "../../lib/supabase";
import { sameNativeSession } from "../auth/native-session-id";
import type { OrganizationView, CenterView, RoleView } from "@ftksaas/api-contracts";

const organizationAuthority = z.object({
  id: z.guid(),
  access_mode: z.enum(["bootstrap", "normal", "grace", "closed"]),
  self_context: z
    .object({
      person_id: z.guid(),
      centers: z.array(
        z.object({
          center_id: z.guid(),
          instructor: z.boolean(),
          student: z.boolean(),
          assistant: z.boolean(),
        }),
      ),
    })
    .nullish(),
  self_management_scope: z
    .object({
      owner: z.boolean(),
      org_manager: z.boolean(),
      managed_center_ids: z.array(z.guid()),
    })
    .nullish(),
});
const centerAuthority = z.object({ id: z.guid(), accessible: z.boolean() });
const roleAuthority = z.object({
  person_id: z.guid(),
  scope_center_id: z.guid().nullable(),
  role: z.enum([
    "owner",
    "org_manager",
    "center_manager",
    "staff",
    "instructor",
    "assistant",
    "student",
  ]),
  account_access_granted: z.boolean().optional(),
});

function nextWorkspaceCursor(next: unknown, seen: Set<string>) {
  if (next === null || next === undefined) return undefined;
  if (typeof next !== "string" || !next) throw new Error("WORKSPACE_PROJECTION_INVALID");
  if (seen.has(next)) throw new Error("WORKSPACE_CURSOR_REPEATED");
  seen.add(next);
  return next;
}

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
  const backend = getBackend(token);
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
  async function confirmSession() {
    signal?.throwIfAborted();
    if (readVerifiedAccount) {
      const latest = await getSupabaseClient().auth.getSession();
      if (latest.error) throw latest.error;
      if (!latest.data.session || !sameNativeSession(session, latest.data.session))
        throw new Error("ACCOUNT_CHANGED");
    }
    signal?.throwIfAborted();
  }
  const session = data.session;
  const projection = await readWorkspaceProjection(backend, organizationId, signal).catch(
    async (error: unknown) => {
      await confirmSession();
      throw error;
    },
  );
  await confirmSession();
  return projection;
}

async function readWorkspaceProjection(
  backend: ReturnType<typeof getBackend>,
  organizationId?: string,
  signal?: AbortSignal,
) {
  const organizations: OrganizationView[] = [];
  const cursors = new Set<string>();
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
    if (
      !Array.isArray(page.items) ||
      !page.items.every((org) => organizationAuthority.safeParse(org).success)
    )
      throw new Error("WORKSPACE_PROJECTION_INVALID");
    organizations.push(...page.items);
    cursor = nextWorkspaceCursor(page.next_cursor, cursors);
  } while (cursor);
  const selected = organizationId
    ? organizations.find((org) => org.id === organizationId)
    : organizations.length === 1
      ? organizations[0]
      : undefined;
  const centers: CenterView[] = [],
    roles: RoleView[] = [];
  if (selected) {
    cursors.clear();
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
      if (
        !Array.isArray(page.items) ||
        !page.items.every((center) => centerAuthority.safeParse(center).success)
      )
        throw new Error("WORKSPACE_PROJECTION_INVALID");
      centers.push(...page.items.filter((center) => center.accessible));
      cursor = nextWorkspaceCursor(page.next_cursor, cursors);
    } while (cursor);
    const personId = selected.self_context?.person_id;
    if (personId) {
      cursors.clear();
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
          if (
            !Array.isArray(page.items) ||
            !page.items.every((role) => roleAuthority.safeParse(role).success)
          )
            throw new Error("WORKSPACE_PROJECTION_INVALID");
          roles.push(...page.items.filter((role) => role.state === "active"));
          cursor = nextWorkspaceCursor(page.next_cursor, cursors);
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
    role.account_access_granted !== false &&
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
