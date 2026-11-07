import { validate } from "uuid";
import type { StarterRetainedScope, SubscriptionView } from "@ftksaas/api-contracts";
import { setupCall, getRooms, readableCenterDiscipline, type SetupScope } from "./studio-setup";
import { getSetupRoles } from "./instructor-setup";
export type RetentionResources = {
  rooms: { id: string; name: string }[];
  disciplines: { id: string; name: string }[];
  instructors: { id: string; name: string }[];
};
async function planProof(
  scope: SetupScope,
  selector:
    | { operation: "subscription_downgrade_request_v1"; key: { target_plan_id: string } }
    | { operation: "subscription_change_cancel_v1"; key: { change_id: string } },
) {
  if (scope.centerId) throw Error("invalidPlanChange");
  const p = await setupCall("management_state_get_v1", {
    org_id: scope.orgId,
    operation: selector.operation,
    selector,
  });
  const r = p.items[0],
    type =
      selector.operation === "subscription_change_cancel_v1"
        ? "saas_change_requests"
        : "saas_subscriptions";
  if (
    p.items.length !== 1 ||
    p.next_cursor ||
    !r?.exists ||
    r.operation !== selector.operation ||
    r.current?.operation !== selector.operation ||
    r.entity?.type !== type ||
    !validate(r.entity.id) ||
    r.versions.length !== 1 ||
    r.versions[0]?.entity.id !== r.entity.id ||
    r.versions[0]?.entity.type !== type ||
    !Number.isSafeInteger(r.versions[0]?.version) ||
    r.versions[0]!.version < 1 ||
    !Object.entries(selector.key).every(([k, v]) => Reflect.get(r.current!.values, k) === v) ||
    (selector.operation === "subscription_change_cancel_v1" &&
      (r.state !== "scheduled" || r.entity.id !== selector.key.change_id))
  )
    throw Error("invalidPlanChange");
  return r.versions[0]!.version;
}
export const readDowngrade = (scope: SetupScope, target: string) =>
  planProof(scope, {
    operation: "subscription_downgrade_request_v1",
    key: { target_plan_id: target },
  });
export const readPlanChange = (scope: SetupScope, id: string) =>
  planProof(scope, { operation: "subscription_change_cancel_v1", key: { change_id: id } });
export async function readSubscription(scope: SetupScope): Promise<SubscriptionView> {
  const p = await setupCall("subscription_get_v1", { org_id: scope.orgId });
  const options = p.billing?.downgrade_options ?? [];
  if (
    (options.length > 0 &&
      (!Number.isSafeInteger(p.subscription_version) || p.subscription_version! < 1)) ||
    new Set(options.map((o) => o.target.id)).size !== options.length ||
    options.some(
      (o) =>
        !validate(o.target.id) ||
        !["starter", "pro"].includes(o.plan) ||
        !Number.isFinite(Date.parse(o.effective_at)) ||
        !/^([1-9][0-9]*)$/.test(o.target.amount_minor) ||
        o.target.currency !== p.billing?.current.currency ||
        o.target.period !== p.billing?.current.period,
    )
  )
    throw Error("invalidPlanChange");
  return p;
}
export function retainedScopeValid(
  s: StarterRetainedScope,
  resources: { [K in keyof RetentionResources]: { id: string }[] },
) {
  return (
    (
      [
        ["room_id", "rooms"],
        ["discipline_id", "disciplines"],
        ["instructor_id", "instructors"],
      ] as const
    ).every(([field, family]) =>
      resources[family].length
        ? resources[family].some((r) => r.id === s[field])
        : s[field] === null,
    ) &&
    s.student_person_ids.length <= 100 &&
    new Set(s.student_person_ids).size === s.student_person_ids.length &&
    s.student_person_ids.every(validate)
  );
}
export async function readRetentionResources(scope: SetupScope): Promise<RetentionResources> {
  if (!scope.centerId) throw Error("invalidPlanChange");
  const [roomRows, roles] = await Promise.all([
    getRooms(scope.orgId, scope.centerId),
    getSetupRoles(scope),
  ]);
  const rooms = roomRows
    .filter((r) => r.state === "active")
    .map((r) => {
      if (
        !r.exists ||
        r.entity?.type !== "rooms" ||
        !validate(r.entity.id) ||
        r.current?.operation !== "room_save_v1" ||
        !r.current.values.name
      )
        throw Error("invalidPlanChange");
      return { id: r.entity.id, name: r.current.values.name };
    });
  const disciplines: RetentionResources["disciplines"] = [];
  let cursor: string | undefined;
  const cursors = new Set<string>();
  do {
    const p = await setupCall("disciplines_list_v1", {
      org_id: scope.orgId,
      page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    for (const d of p.items.filter((d) => d.state === "active")) {
      const relation = await setupCall("management_state_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation: "center_discipline_set_v1",
        selector: { operation: "center_discipline_set_v1", key: { discipline_id: d.id } },
      });
      const r = relation.items[0];
      if (relation.items.length !== 1 || relation.next_cursor || !readableCenterDiscipline(r, d.id))
        throw Error("invalidPlanChange");
      if (
        r?.current?.operation === "center_discipline_set_v1" &&
        r.current.values.state === "active"
      )
        disciplines.push({ id: d.id, name: d.name });
    }
    cursor = p.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw Error("invalidPlanChange");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  const ids = [
    ...new Set(
      roles
        .filter(
          (r) =>
            r.role === "instructor" && r.state === "active" && r.scope_center_id === scope.centerId,
        )
        .map((r) => r.person_id),
    ),
  ];
  const instructors = await Promise.all(
    ids.map(async (id) => {
      const p = await setupCall("person_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        person_id: id,
      });
      if (p.id !== id) throw Error("invalidPlanChange");
      return { id, name: p.display_name };
    }),
  );
  if ([rooms, disciplines, instructors].some((a) => new Set(a.map((r) => r.id)).size !== a.length))
    throw Error("invalidPlanChange");
  return { rooms, disciplines, instructors };
}
export async function readRetainedStudents(scope: SetupScope, query: string, cursor?: string) {
  const p = await setupCall("people_list_v1", {
    org_id: scope.orgId,
    center_id: scope.centerId,
    relationship: "student",
    ...(query ? { query } : {}),
    page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  if ((cursor && p.next_cursor === cursor) || p.items.some((r) => !validate(r.id)))
    throw Error("invalidPlanChange");
  return {
    ...p,
    items: p.items.filter((p) =>
      p.relationships.some(
        (r) => r.center_id === scope.centerId && r.kind === "student" && r.state === "active",
      ),
    ),
  };
}
