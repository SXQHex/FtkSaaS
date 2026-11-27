import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { ClientScope, AccountReadContext } from "../../lib/scoped-backend";
import { scopedBackend } from "../../lib/scoped-backend";
import { queryBackendRead } from "../../lib/backend";
import type {
  InstructorRevocationPreview,
  ManagementSelectorPermissionSetV1,
  Permission,
  RoleView,
  RequestRoleAssign,
  RequestRoleRevoke,
  RequestPermissionSet,
  RequestOrgManagerAssign,
  RequestOrgManagerRevoke,
  RequestCenterManagerAssign,
  RequestCenterManagerRevoke,
} from "@ftksaas/api-contracts";
export const teamRoles = ["staff", "instructor", "assistant"] as const;
export type TeamRole = (typeof teamRoles)[number];
export type ManagerRole = "org_manager" | "center_manager";
export type TeamDirectoryRole = TeamRole | ManagerRole;
export const directoryRoles = [...teamRoles, "center_manager", "org_manager"] as const;
export const teamPermissions = [
  "person.manage",
  "person.activate",
  "invite.student",
  "reservation.write",
  "attendance.draft",
  "sale.write",
  "finance.collect",
  "sale.discount",
  "reservation.capacity_override",
  "request.write",
  "request.resolve",
  "crm.daily",
] as const satisfies readonly Permission[];
export type TeamPermission = (typeof teamPermissions)[number];
export type TeamPermissionMember = {
  id: string;
  name: string | null;
  manager: boolean;
  staff: boolean;
  version: number;
  cells: Partial<
    Record<
      TeamPermission,
      {
        enabled: boolean | null;
        effective: boolean;
        writable: boolean;
      }
    >
  >;
};
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
const organizationCommon = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
});
export async function readTeamPage(
  scope: ClientScope,
  role: TeamDirectoryRole,
  cursor?: string,
  level: "center" | "organization" = "center",
  state: "active" | "inactive" = "active",
  readContext?: AccountReadContext,
  includePersonDetails = false,
) {
  const backend = await scopedBackend(scope, undefined, readContext);
  const organization = level === "organization" || role === "org_manager";
  const requestScope = organization ? organizationCommon(scope) : common(scope);
  const page = await queryBackendRead(
    backend,
    "roles_list_v1",
    {
      ...requestScope,
      request_id: uuidv7(),
      role,
      state,
      include_person_display_names: true,
      page: { limit: 20, ...(cursor ? { cursor } : {}) },
    },
    readContext?.signal,
  );
  if (
    page.items.length > 20 ||
    (cursor && page.next_cursor === cursor) ||
    new Set(page.items.map((row) => row.id)).size !== page.items.length
  )
    throw Error("TEAM_SOURCE_INVALID");
  const records = page.items.map((row) => {
    if (
      row.role !== role ||
      row.state !== state ||
      (role === "org_manager"
        ? row.scope_center_id !== null
        : !organization && row.scope_center_id !== scope.centerId)
    )
      throw Error("TEAM_SOURCE_INVALID");
    z.uuid().parse(row.id);
    z.uuid().parse(row.person_id);
    return {
      id: row.id,
      personId: row.person_id,
      role,
      state: row.state,
      version: z.number().int().positive().safe().parse(row.version),
      bound: row.account_access_granted ?? null,
      name: row.person_display_name,
    };
  });
  const people = new Map<string, Awaited<ReturnType<typeof backend.call<"person_get_v1">>>>();
  const ids = [
    ...new Set(
      records
        .filter((row) => includePersonDetails || row.name === undefined)
        .map((row) => row.personId),
    ),
  ];
  for (let start = 0; start < ids.length; start += 4)
    await Promise.all(
      ids.slice(start, start + 4).map(async (id) => {
        const person = await queryBackendRead(
          backend,
          "person_get_v1",
          { ...requestScope, request_id: uuidv7(), person_id: id },
          readContext?.signal,
        );
        if (person.id !== id && !person.linked_person_ids?.includes(id))
          throw Error("TEAM_SOURCE_INVALID");
        people.set(id, person);
      }),
    );
  return {
    ...page,
    records: records.map((row) => {
      const person = people.get(row.personId);
      return { ...row, name: row.name ?? person!.display_name, person };
    }),
  };
}
export async function readTeamPeople(
  scope: ClientScope,
  query: string,
  cursor?: string,
  manager?: ManagerRole,
  readContext?: AccountReadContext,
) {
  return (await scopedBackend(scope, undefined, readContext)).call("people_list_v1", {
    ...(manager ? organizationCommon(scope) : common(scope)),
    request_id: uuidv7(),
    query: z.string().trim().min(2).max(200).parse(query),
    page: { limit: 20, ...(cursor ? { cursor } : {}) },
  });
}
export async function readTeamPerson(
  scope: ClientScope,
  id: string,
  manager?: ManagerRole,
  signal?: AbortSignal,
) {
  return queryBackendRead(
    await scopedBackend(scope, signal),
    "person_get_v1",
    {
      ...(manager ? organizationCommon(scope) : common(scope)),
      request_id: uuidv7(),
      person_id: z.uuid().parse(id),
    },
    signal,
  );
}
export async function readTeamPersonRoles(
  scope: ClientScope,
  personId: string,
  manager?: ManagerRole,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, readContext),
    items: RoleView[] = [];
  let cursor: string | undefined;
  do {
    const page = await backend.call("roles_list_v1", {
      ...(manager === "org_manager" ? organizationCommon(scope) : common(scope)),
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
export async function readTeamPermissionDirectory(
  scope: ClientScope,
  readContext: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, readContext);
  const limit = 50;
  const people = new Map<string, TeamPermissionMember>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await queryBackendRead(
      backend,
      "management_state_get_v1",
      {
        ...common(scope),
        request_id: uuidv7(),
        operation: "permission_set_v1",
        selector: { operation: "permission_set_v1", key: { directory: "center" } },
        page: { limit, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
      },
      readContext.signal,
    );
    if (page.items.length > limit || (page.next_cursor && !page.items.length))
      throw Error("TEAM_SOURCE_INVALID");
    for (const row of page.items) {
      if (
        !row.exists ||
        row.state !== "active" ||
        row.operation !== "permission_set_v1" ||
        row.entity?.type !== "people" ||
        row.current?.operation !== "permission_set_v1"
      )
        throw Error("TEAM_SOURCE_INVALID");
      const {
        person_id: id,
        display_name: name,
        team_roles: roles,
        permission_overrides: overrides,
      } = row.current.values;
      if (!id || id !== row.entity.id || name === undefined || !roles?.length || people.has(id))
        throw Error("TEAM_SOURCE_INVALID");
      const versions = row.versions.filter(
        (item) => item.entity.type === "people" && item.entity.id === id,
      );
      if (versions.length !== 1) throw Error("TEAM_SOURCE_INVALID");
      const version = z.number().int().positive().safe().parse(versions[0]!.version);
      const summary = parseTeamPermissionCells(overrides);
      people.set(id, {
        id,
        name,
        manager: roles.includes("center_manager"),
        staff: roles.includes("staff"),
        version,
        cells: Object.fromEntries(
          teamPermissions.flatMap((permission) => {
            const cell = summary.get(permission);
            return cell
              ? [
                  [
                    permission,
                    {
                      enabled: cell.enabled,
                      effective: cell.effective_staff_grant,
                      writable: cell.writable === true,
                    },
                  ] as const,
                ]
              : [];
          }),
        ),
      });
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor) {
      if (cursors.has(cursor)) throw Error("TEAM_SOURCE_INVALID");
      cursors.add(cursor);
    }
  } while (cursor);
  return [...people.values()].filter(({ manager, staff }) => manager || staff);
}

async function readTeamPermissionSource(
  scope: ClientScope,
  key: ManagementSelectorPermissionSetV1["key"],
  readContext?: AccountReadContext,
) {
  const personId = z.uuid().parse(key.person_id);
  const backend = await scopedBackend(scope, undefined, readContext);
  const data = await backend.call("management_state_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
    operation: "permission_set_v1",
    selector: { operation: "permission_set_v1", key },
    page: { limit: 1 },
  });
  const row = data.items[0];
  if (
    data.items.length !== 1 ||
    data.next_cursor ||
    !row?.exists ||
    row.operation !== "permission_set_v1" ||
    row.entity?.type !== "people" ||
    row.entity.id !== personId ||
    row.current?.operation !== "permission_set_v1" ||
    row.current.values.person_id !== personId
  )
    throw Error("TEAM_PERMISSION_UNAVAILABLE");
  const versions = row.versions.filter(
    (item) => item.entity.type === "people" && item.entity.id === personId,
  );
  if (versions.length !== 1) throw Error("TEAM_PERMISSION_UNAVAILABLE");
  const version = z.number().int().positive().safe().parse(versions[0]!.version);
  return { values: row.current.values, version };
}

async function readTeamPermission(
  scope: ClientScope,
  personId: string,
  permission: TeamPermission,
) {
  const { values, version } = await readTeamPermissionSource(scope, {
    person_id: personId,
    permission,
  });
  const { enabled, override_exists: overrideExists } = values;
  if (
    values.permission !== permission ||
    typeof overrideExists !== "boolean" ||
    (overrideExists && typeof enabled !== "boolean")
  )
    throw Error("TEAM_PERMISSION_UNAVAILABLE");
  return {
    personId,
    permission,
    enabled: overrideExists ? enabled : null,
    overrideExists,
    version,
  };
}

const permissionSummary = z.array(
  z.object({
    permission: z.string().min(1),
    override_exists: z.boolean(),
    enabled: z.boolean().nullable(),
    override_version: z.number().int().positive().safe().nullable(),
    effective_staff_grant: z.boolean(),
    writable: z.boolean().optional(),
  }),
);

function parseTeamPermissionCells(overrides: unknown) {
  const source = permissionSummary.safeParse(overrides);
  if (!source.success) throw Error("TEAM_PERMISSION_UNAVAILABLE");
  const byPermission = new Map(source.data.map((row) => [row.permission, row]));
  if (
    byPermission.size !== source.data.length ||
    source.data.some((row) =>
      row.override_exists
        ? row.enabled === null || row.override_version === null
        : row.enabled !== null || row.override_version !== null,
    )
  )
    throw Error("TEAM_PERMISSION_UNAVAILABLE");
  return byPermission;
}

export async function readTeamPermissions(
  scope: ClientScope,
  personId: string,
  readContext?: AccountReadContext,
) {
  const { values, version } = await readTeamPermissionSource(
    scope,
    { person_id: personId, permission_summary: true },
    readContext,
  );
  const byPermission = parseTeamPermissionCells(values.permission_overrides);
  return teamPermissions.flatMap((permission) => {
    const row = byPermission.get(permission);
    return row
      ? [
          {
            personId,
            permission,
            enabled: row.enabled,
            overrideExists: row.override_exists,
            overrideVersion: row.override_version,
            effectiveStaffGrant: row.effective_staff_grant,
            version,
          },
        ]
      : [];
  });
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
    }
  | {
      scope: ClientScope;
      operation: "org_manager_assign_v1";
      request: Omit<RequestOrgManagerAssign, "request_id">;
    }
  | {
      scope: ClientScope;
      operation: "center_manager_assign_v1";
      request: Omit<RequestCenterManagerAssign, "request_id">;
    }
  | {
      scope: ClientScope;
      operation: "org_manager_revoke_v1";
      request: Omit<RequestOrgManagerRevoke, "request_id">;
      assignmentId: string;
    }
  | {
      scope: ClientScope;
      operation: "center_manager_revoke_v1";
      request: Omit<RequestCenterManagerRevoke, "request_id">;
      assignmentId: string;
    };
export function teamRoleAssignment(
  scope: ClientScope,
  personId: string,
  role: "center_manager" | "staff",
) {
  const request = {
    ...common(scope),
    operation_key: uuidv7(),
    person_id: z.uuid().parse(personId),
  };
  return role === "center_manager"
    ? { scope: { ...scope }, operation: "center_manager_assign_v1" as const, request }
    : {
        scope: { ...scope },
        operation: "role_assign_v1" as const,
        request: { ...request, role, scope: { center_id: scope.centerId } },
      };
}

async function prepareManagerRole(
  scope: ClientScope,
  personId: string,
  role: ManagerRole,
  enabled: boolean,
  reason: string,
): Promise<TeamIntent> {
  const current = await readTeamPersonRoles(scope, personId, role),
    active = current.find(
      (row) =>
        row.role === role &&
        row.scope_center_id === (role === "org_manager" ? null : scope.centerId) &&
        row.state === "active",
    );
  if (enabled && active) throw Error("TEAM_ROLE_ALREADY_ACTIVE");
  if (!enabled && !active) throw Error("TEAM_ROLE_NOT_ACTIVE");
  const operation =
    role === "org_manager"
      ? enabled
        ? "org_manager_assign_v1"
        : "org_manager_revoke_v1"
      : enabled
        ? "center_manager_assign_v1"
        : "center_manager_revoke_v1";
  const scoped = role === "org_manager" ? organizationCommon(scope) : common(scope);
  // Assignment is an organization-owner command; no existing assignment or
  // center-manager inspection authority is required to prepare it.
  // Keep the source/version read for revocation, where a real assignment exists.
  if (!enabled) {
    const page = await (
      await scopedBackend(scope)
    ).call("management_state_get_v1", {
      ...scoped,
      request_id: uuidv7(),
      operation,
      selector: { operation, key: { person_id: personId } },
      page: { limit: 1 },
    });
    const row = page.items[0];
    if (
      page.items.length !== 1 ||
      page.next_cursor ||
      row?.operation !== operation ||
      (!enabled && !row.exists) ||
      (row.current &&
        (row.current.operation !== operation || row.current.values.person_id !== personId))
    )
      throw Error("TEAM_SOURCE_INVALID");
  }
  const request = { ...scoped, operation_key: uuidv7(), person_id: personId };
  if (enabled)
    return role === "org_manager"
      ? { scope: { ...scope }, operation: "org_manager_assign_v1", request }
      : { scope: { ...scope }, operation: "center_manager_assign_v1", request };
  const revoke = {
    ...request,
    expected_version: active!.version,
    reason: z.string().trim().min(1).max(1000).parse(reason),
  };
  return role === "org_manager"
    ? {
        scope: { ...scope },
        operation: "org_manager_revoke_v1",
        request: revoke,
        assignmentId: active!.id,
      }
    : {
        scope: { ...scope },
        operation: "center_manager_revoke_v1",
        request: revoke,
        assignmentId: active!.id,
      };
}
export async function prepareTeamRole(
  scope: ClientScope,
  personId: string,
  role: TeamDirectoryRole,
  enabled: boolean,
  reason: string,
): Promise<TeamIntent> {
  if (role === "org_manager" || role === "center_manager")
    return prepareManagerRole(scope, personId, role, enabled, reason);
  const current = await readTeamPersonRoles(scope, personId),
    active = current.find(
      (row) =>
        row.role === role && row.scope_center_id === scope.centerId && row.state === "active",
    );
  if (enabled) {
    if (active && active.account_access_granted !== false) throw Error("TEAM_ROLE_ALREADY_ACTIVE");
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

export async function readStaffRemovalPreview(
  scope: ClientScope,
  personId: string,
  assignmentId: string,
  context: AccountReadContext,
) {
  const roles = await readTeamPersonRoles(scope, personId, undefined, context);
  const staff = roles.find(
    (row) =>
      row.id === assignmentId &&
      row.role === "staff" &&
      row.state === "active" &&
      row.scope_center_id === scope.centerId,
  );
  if (!staff) throw Error("TEAM_ROLE_NOT_ACTIVE");
  const preview = await queryBackendRead(
    await scopedBackend(scope, undefined, context),
    "role_revoke_preview_v1",
    {
      ...common(scope),
      request_id: uuidv7(),
      assignment_id: staff.id,
      expected_version: staff.version,
    },
    context.signal,
  );
  const impact = preview.staff_impact;
  if (
    preview.assignment_id !== staff.id ||
    preview.assignment_version !== staff.version ||
    !z.uuid().safeParse(preview.id).success ||
    !preview.token ||
    !(Date.parse(preview.expires_at) > Date.now()) ||
    !impact ||
    !Array.isArray(impact.lost_permissions) ||
    !Array.isArray(impact.open_leads) ||
    !Array.isArray(impact.recipients) ||
    impact.handover_required !== impact.open_leads.length > 0
  )
    throw Error("TEAM_REVOCATION_PREVIEW_INVALID");
  return { ...preview, staff_impact: impact };
}

export function confirmedStaffRemoval(
  scope: ClientScope,
  preview: Awaited<ReturnType<typeof readStaffRemovalPreview>>,
  recipientId?: string,
) {
  const handover = preview.staff_impact.handover_required;
  if (
    handover &&
    !preview.staff_impact.recipients.some((person) => person.person_id === recipientId)
  )
    throw Error("TEAM_REVOCATION_RECIPIENT_INVALID");
  return {
    scope: { ...scope },
    operation: "role_revoke_v1" as const,
    request: {
      ...common(scope),
      operation_key: uuidv7(),
      assignment_id: preview.assignment_id,
      expected_version: preview.assignment_version,
      reason: "Ekip önizlemesinde onaylanan Personel rolü kaldırma işlemi.",
      impact_approval: { id: preview.id, token: preview.token },
      ...(handover ? { handover_person_id: recipientId } : {}),
    },
  } satisfies TeamIntent;
}
export async function prepareTeamPermission(
  scope: ClientScope,
  personId: string,
  permission: TeamPermission,
  enabled: boolean,
): Promise<TeamIntent> {
  const current = await readTeamPermission(scope, personId, permission);
  return teamPermissionIntent(scope, personId, permission, enabled, current.version);
}

export function teamPermissionIntent(
  scope: ClientScope,
  personId: string,
  permission: TeamPermission,
  enabled: boolean,
  version: number,
) {
  return {
    scope: { ...scope },
    operation: "permission_set_v1" as const,
    request: {
      ...common(scope),
      operation_key: uuidv7(),
      person_id: personId,
      permission,
      enabled,
      expected_version: version,
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
  if (intent.operation === "org_manager_assign_v1")
    return backend.call(intent.operation, { ...intent.request, request_id });
  if (intent.operation === "center_manager_assign_v1")
    return backend.call(intent.operation, { ...intent.request, request_id });
  if (intent.operation === "org_manager_revoke_v1")
    return backend.call(intent.operation, { ...intent.request, request_id });
  if (intent.operation === "center_manager_revoke_v1")
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
  if (
    intent.operation === "org_manager_assign_v1" ||
    intent.operation === "center_manager_assign_v1" ||
    intent.operation === "org_manager_revoke_v1" ||
    intent.operation === "center_manager_revoke_v1"
  ) {
    const role = intent.operation.startsWith("org_") ? "org_manager" : "center_manager";
    const roles = await readTeamPersonRoles(intent.scope, intent.request.person_id, role);
    const revoke = "assignmentId" in intent;
    if (revoke && id !== intent.assignmentId) throw Error("TEAM_RESULT_UNAVAILABLE");
    if (
      !roles.some(
        (row) =>
          row.id === id &&
          row.role === role &&
          row.scope_center_id === (role === "org_manager" ? null : intent.scope.centerId) &&
          row.state === (revoke ? "inactive" : "active"),
      )
    )
      throw Error("TEAM_RESULT_UNAVAILABLE");
    return roles;
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
    return roles;
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
