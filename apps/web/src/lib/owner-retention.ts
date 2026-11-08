import { validate } from "uuid";
import { setupCall, type SetupScope } from "./studio-setup";
export type RetainedPerson = { id: string; name: string; subscriber_number: string | null };
export async function readOwnerResources(
  scope: SetupScope,
  target: string,
  version: number,
  kind: "rooms" | "disciplines" | "instructors" | "students",
  query = "",
  cursor?: string,
) {
  if (
    !scope.centerId ||
    !validate(target) ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    (query && !/^[0-9]+$/.test(query))
  )
    throw Error("invalidPlanChange");
  const p = await setupCall("management_state_get_v1", {
    org_id: scope.orgId,
    operation: "subscription_downgrade_request_v1",
    selector: {
      operation: "subscription_downgrade_request_v1",
      key: { target_plan_id: target, kept_center_id: scope.centerId, expected_version: version },
      resources: kind,
      ...(query ? { subscriber_number: query } : {}),
    },
    page: { limit: 200, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  if (cursor && p.next_cursor === cursor) throw Error("invalidPlanChange");
  let subscription: string | undefined;
  const items = p.items.map((r) => {
    const d = r.retained_resource;
    if (
      r.operation !== "subscription_downgrade_request_v1" ||
      !r.exists ||
      r.entity?.type !== "saas_subscriptions" ||
      !validate(r.entity.id) ||
      (subscription && subscription !== r.entity.id) ||
      r.versions.length !== 1 ||
      r.versions[0]?.entity.type !== "saas_subscriptions" ||
      r.versions[0]?.entity.id !== r.entity.id ||
      r.versions[0]?.version !== version ||
      !d ||
      d.kind !== kind ||
      !validate(d.id) ||
      !d.display_name.trim() ||
      (d.subscriber_number !== null && !/^[0-9]+$/.test(d.subscriber_number)) ||
      (query && d.subscriber_number !== query)
    )
      throw Error("invalidPlanChange");
    subscription = r.entity.id;
    return { id: d.id, name: d.display_name, subscriber_number: d.subscriber_number };
  });
  if (new Set(items.map((r) => r.id)).size !== items.length) throw Error("invalidPlanChange");
  return { items, next_cursor: p.next_cursor };
}
export async function readOwnerRetention(scope: SetupScope, target: string, version: number) {
  const read = async (kind: "rooms" | "disciplines" | "instructors") => {
    const all: RetainedPerson[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const p = await readOwnerResources(scope, target, version, kind, "", cursor);
      all.push(...p.items);
      cursor = p.next_cursor ?? undefined;
      if (cursor && seen.has(cursor)) throw Error("invalidPlanChange");
      if (cursor) seen.add(cursor);
    } while (cursor);
    if (new Set(all.map((r) => r.id)).size !== all.length) throw Error("invalidPlanChange");
    return all;
  };
  const [rooms, disciplines, instructors] = await Promise.all([
    read("rooms"),
    read("disciplines"),
    read("instructors"),
  ]);
  return { rooms, disciplines, instructors };
}
