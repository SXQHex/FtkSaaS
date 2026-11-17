import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { ClientScope } from "../../lib/scoped-backend";
import { scopedBackend } from "../../lib/scoped-backend";
import type {
  InstructorRevocationPreview,
  Permission,
  RoleView,
  RequestRoleAssign,
  RequestRoleRevoke,
  RequestPermissionSet,
} from "../../lib/api-contracts/generated";
export const teamRoles = ["staff", "instructor", "assistant"] as const;
export type TeamRole = (typeof teamRoles)[number];
export const teamPermissions = [
  "person.manage",
  "person.activate",
  "invite.student",
  "reservation.write",
  "attendance.draft",
  "sale.write",
  "finance.collect",
  "reservation.capacity_override",
] as const satisfies readonly Permission[];
export type TeamPermission = (typeof teamPermissions)[number];
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export async function readTeamPage(scope: ClientScope, role: TeamRole, cursor?: string) {
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
    operation: "role_assign_v1",
    selector: { operation: "role_assign_v1", key: { role, scope: { center_id: scope.centerId } } },
    page: { limit: 20, ...(cursor ? { cursor } : {}) },
  });
  if (page.items.length > 20 || (cursor && page.next_cursor === cursor))
    throw Error("TEAM_SOURCE_INVALID");
  const records = page.items.map((row) => {
    if (
      row.current?.operation !== "role_assign_v1" ||
      row.current.values.role !== role ||
      row.current.values.scope?.center_id !== scope.centerId ||
      !row.current.values.person_id ||
      row.entity?.type !== "role_assignments"
    )
      throw Error("TEAM_SOURCE_INVALID");
    const version = row.versions.filter(
      (item) => item.entity.type === "role_assignments" && item.entity.id === row.entity!.id,
    );
    if (version.length !== 1) throw Error("TEAM_SOURCE_INVALID");
    return {
      id: row.entity.id,
      personId: row.current.values.person_id,
      role,
      state: row.state,
      version: z.number().int().positive().safe().parse(version[0]!.version),
      bound: row.account_access_granted ?? null,
    };
  });
  const people = new Map<string, Awaited<ReturnType<typeof backend.call<"person_get_v1">>>>();
  const ids = [...new Set(records.map((row) => row.personId))];
  // Only this visible native page needs names; no center-wide people scan.
  for (let start = 0; start < ids.length; start += 4)
    await Promise.all(
      ids.slice(start, start + 4).map(async (id) => {
        const person = await backend.call("person_get_v1", {
          ...common(scope),
          request_id: uuidv7(),
          person_id: id,
        });
        if (person.id !== id) throw Error("TEAM_SOURCE_INVALID");
        people.set(id, person);
      }),
    );
  return {
    ...page,
    records: records.map((row) => ({ ...row, person: people.get(row.personId)! })),
  };
}
export async function readTeamPersonRoles(scope: ClientScope, personId: string) {
  const backend = await scopedBackend(scope),
    items: RoleView[] = [];
  let cursor: string | undefined;
  do {
    const page = await backend.call("roles_list_v1", {
      ...common(scope),
      request_id: uuidv7(),
      person_id: z.uuid().parse(personId),
      page: { limit: 100, ...(cursor ? { cursor } : {}) },
    });
    if (cursor && page.next_cursor === cursor) throw Error("TEAM_SOURCE_INVALID");
    items.push(...page.items);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  if (
    items.some((row) => row.person_id !== personId) ||
    new Set(items.map((row) => row.id)).size !== items.length
  )
    throw Error("TEAM_SOURCE_INVALID");
  return items;
}
export async function readTeamPermission(
  scope: ClientScope,
  personId: string,
  permission: TeamPermission,
  client?: Awaited<ReturnType<typeof scopedBackend>>,
) {
  const data = await (client ?? (await scopedBackend(scope))).call("management_state_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
    operation: "permission_set_v1",
    selector: { operation: "permission_set_v1", key: { person_id: personId, permission } },
    page: { limit: 1 },
  });
  const row = data.items[0];
  if (
    data.items.length !== 1 ||
    data.next_cursor ||
    row?.current?.operation !== "permission_set_v1" ||
    row.current.values.person_id !== personId ||
    row.current.values.permission !== permission ||
    typeof row.current.values.enabled !== "boolean" ||
    typeof row.current.values.override_exists !== "boolean"
  )
    throw Error("TEAM_PERMISSION_UNAVAILABLE");
  const versions = row.versions.filter(
    (item) => item.entity.type === "people" && item.entity.id === personId,
  );
  if (versions.length !== 1) throw Error("TEAM_PERMISSION_UNAVAILABLE");
  return {
    personId,
    permission,
    enabled: row.current.values.enabled,
    overrideExists: row.current.values.override_exists,
    version: z.number().int().positive().safe().parse(versions[0]!.version),
  };
}
export async function readTeamPermissions(scope: ClientScope, personId: string) {
  const backend = await scopedBackend(scope);
  return Promise.all(
    teamPermissions.map((permission) => readTeamPermission(scope, personId, permission, backend)),
  );
}
export type TeamIntent =
  | {
      scope: ClientScope;
      operation: "role_assign_v1";
      request: Omit<RequestRoleAssign, "request_id">;
    }
  | {
      scope: ClientScope;
      operation: "role_revoke_v1";
      request: Omit<RequestRoleRevoke, "request_id">;
      preview?: InstructorRevocationPreview;
    }
  | {
      scope: ClientScope;
      operation: "permission_set_v1";
      request: Omit<RequestPermissionSet, "request_id">;
    };
export async function prepareTeamRole(
  scope: ClientScope,
  personId: string,
  role: TeamRole,
  enabled: boolean,
  reason: string,
): Promise<TeamIntent> {
  const current = await readTeamPersonRoles(scope, personId),
    active = current.find(
      (row) =>
        row.role === role && row.scope_center_id === scope.centerId && row.state === "active",
    );
  if (enabled) {
    if (active) throw Error("TEAM_ROLE_ALREADY_ACTIVE");
    return {
      scope: { ...scope },
      operation: "role_assign_v1",
      request: {
        ...common(scope),
        operation_key: uuidv7(),
        person_id: personId,
        role,
        scope: { center_id: scope.centerId },
      },
    };
  }
  if (!active) throw Error("TEAM_ROLE_NOT_ACTIVE");
  let preview: InstructorRevocationPreview | undefined;
  if (role === "instructor") {
    preview = await (
      await scopedBackend(scope)
    ).call("role_revoke_preview_v1", {
      ...common(scope),
      request_id: uuidv7(),
      assignment_id: active.id,
      expected_version: active.version,
    });
    if (
      preview.assignment_id !== active.id ||
      preview.assignment_version !== active.version ||
      Date.parse(preview.expires_at) <= Date.now()
    )
      throw Error("TEAM_REVOCATION_PREVIEW_INVALID");
  }
  return {
    scope: { ...scope },
    operation: "role_revoke_v1",
    request: {
      ...common(scope),
      operation_key: uuidv7(),
      assignment_id: active.id,
      expected_version: active.version,
      reason: z.string().trim().min(1).max(1000).parse(reason),
      ...(preview ? { impact_approval: { id: preview.id, token: preview.token } } : {}),
    },
    ...(preview ? { preview } : {}),
  };
}
export async function prepareTeamPermission(
  scope: ClientScope,
  personId: string,
  permission: TeamPermission,
  enabled: boolean,
): Promise<TeamIntent> {
  const current = await readTeamPermission(scope, personId, permission);
  return {
    scope: { ...scope },
    operation: "permission_set_v1",
    request: {
      ...common(scope),
      operation_key: uuidv7(),
      person_id: personId,
      permission,
      enabled,
      expected_version: current.version,
    },
  };
}
export async function writeTeam(intent: TeamIntent) {
  const backend = await scopedBackend(intent.scope),
    request_id = uuidv7();
  if (intent.operation === "role_assign_v1")
    return backend.call(intent.operation, { ...intent.request, request_id });
  if (intent.operation === "role_revoke_v1")
    return backend.call(intent.operation, { ...intent.request, request_id });
  return backend.call(intent.operation, { ...intent.request, request_id });
}
export async function teamReceipt(intent: TeamIntent) {
  const data = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  if (
    data.operation !== intent.operation ||
    data.key !== intent.request.operation_key ||
    (data.result_reference &&
      data.result_reference.type !==
        (intent.operation === "permission_set_v1" ? "permission_overrides" : "role_assignments"))
  )
    throw Error("TEAM_RECEIPT_INVALID");
  return data;
}
export async function teamResult(intent: TeamIntent, id?: string) {
  if (!id) throw Error("TEAM_RESULT_UNAVAILABLE");
  if (intent.operation === "permission_set_v1") {
    const result = await readTeamPermission(
      intent.scope,
      intent.request.person_id,
      intent.request.permission as TeamPermission,
    );
    if (
      result.enabled !== intent.request.enabled ||
      !result.overrideExists ||
      result.version <= intent.request.expected_version
    )
      throw Error("TEAM_RESULT_UNAVAILABLE");
    return;
  }
  if (intent.operation === "role_assign_v1") {
    const roles = await readTeamPersonRoles(intent.scope, intent.request.person_id);
    if (
      !roles.some(
        (row) =>
          row.id === id &&
          row.role === intent.request.role &&
          row.scope_center_id === intent.scope.centerId &&
          row.state === "active",
      )
    )
      throw Error("TEAM_RESULT_UNAVAILABLE");
    return;
  }
  if (id !== intent.request.assignment_id) throw Error("TEAM_RESULT_UNAVAILABLE");
  const page = await (
    await scopedBackend(intent.scope)
  ).call("management_state_get_v1", {
    ...common(intent.scope),
    request_id: uuidv7(),
    operation: "role_revoke_v1",
    selector: { operation: "role_revoke_v1", key: { assignment_id: id } },
    page: { limit: 1 },
  });
  if (
    page.items.length !== 1 ||
    page.items[0]?.entity?.id !== id ||
    page.items[0]?.state !== "inactive"
  )
    throw Error("TEAM_RESULT_UNAVAILABLE");
}
