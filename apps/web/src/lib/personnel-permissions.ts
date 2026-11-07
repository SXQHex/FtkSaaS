import { setupCall, type SetupScope } from "./studio-setup";
import type { Operations } from "@ftksaas/api-contracts";
import type { PersonnelPermission } from "./pro-access-command";
export async function readPermission(
  scope: SetupScope,
  personId: string,
  permission: PersonnelPermission,
) {
  if (!scope.centerId) throw Error("invalidPermission");
  const p = await setupCall("management_state_get_v1", {
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "permission_set_v1",
    selector: { operation: "permission_set_v1", key: { person_id: personId, permission } },
  });
  const row = p.items[0],
    current = row?.current;
  if (
    p.items.length !== 1 ||
    p.next_cursor ||
    !row?.exists ||
    row.entity?.type !== "people" ||
    row.entity.id !== personId ||
    row.operation !== "permission_set_v1" ||
    current?.operation !== "permission_set_v1" ||
    current.values.person_id !== personId ||
    current.values.permission !== permission ||
    row.versions.length !== 1 ||
    row.versions[0]?.entity.type !== "people" ||
    row.versions[0]?.entity.id !== personId ||
    !Number.isSafeInteger(row.versions[0]?.version) ||
    row.versions[0]!.version <= 0 ||
    typeof current.values.override_exists !== "boolean" ||
    (current.values.override_exists
      ? typeof current.values.enabled !== "boolean"
      : current.values.enabled !== undefined)
  )
    throw Error("invalidPermission");
  return {
    version: row.versions[0]!.version,
    overrideExists: current.values.override_exists,
    ...(current.values.override_exists ? { enabled: current.values.enabled! } : {}),
  };
}

export async function readPersonnel(scope: SetupScope) {
  if (!scope.centerId) throw Error("invalidPermission");
  const people = new Map<string, { id: string; name: string }>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page: Operations["roles_list_v1"]["response"]["data"] = await setupCall("roles_list_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    for (const r of page.items) {
      if (
        r.scope_center_id !== scope.centerId ||
        r.state !== "active" ||
        !["staff", "instructor"].includes(r.role) ||
        people.has(r.person_id)
      )
        continue;
      const p = await setupCall("person_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        person_id: r.person_id,
      });
      if (p.id !== r.person_id) throw Error("invalidPermission");
      people.set(p.id, { id: p.id, name: p.display_name });
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw Error("invalidPermission");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return [...people.values()];
}
