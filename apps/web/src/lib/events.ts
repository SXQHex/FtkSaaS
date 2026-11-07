import type { EventView, ProductView } from "@ftksaas/api-contracts";
import { setupCall, getRooms, type SetupScope } from "./studio-setup";
import { productDisciplines, listProducts } from "./products";
export async function eventDetail(scope: SetupScope, id: string): Promise<EventView> {
  const e = await setupCall("event_get_v1", {
    org_id: scope.orgId,
    center_id: scope.centerId,
    event_id: id,
  });
  if (e.id !== id || e.center_id !== scope.centerId) throw Error("invalidEvent");
  return e;
}
export async function eventCatalog(scope: SetupScope) {
  const [rooms, disciplines] = await Promise.all([
      getRooms(scope.orgId, scope.centerId!),
      productDisciplines(scope),
    ]),
    people = new Map<string, { id: string; name: string }>(),
    products: ProductView[] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const p = await setupCall("roles_list_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    for (const r of p.items) {
      if (
        r.scope_center_id !== scope.centerId ||
        r.state !== "active" ||
        !["instructor", "assistant"].includes(r.role) ||
        people.has(r.person_id)
      )
        continue;
      const person = await setupCall("person_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        person_id: r.person_id,
      });
      if (person.id !== r.person_id) throw Error("invalidEvent");
      people.set(person.id, { id: person.id, name: person.display_name });
    }
    cursor = p.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw Error("invalidEvent");
    if (cursor) seen.add(cursor);
  } while (cursor);
  seen.clear();
  do {
    const p = await listProducts(scope, cursor);
    products.push(...p.items);
    cursor = p.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw Error("invalidEvent");
    if (cursor) seen.add(cursor);
  } while (cursor);
  return {
    rooms: rooms.flatMap((r) =>
      r.state === "active" && r.entity?.type === "rooms" && r.current?.operation === "room_save_v1"
        ? [{ id: r.entity.id, name: r.current.values.name!, capacity: r.current.values.capacity }]
        : [],
    ),
    disciplines,
    people: [...people.values()],
    products,
  };
}
