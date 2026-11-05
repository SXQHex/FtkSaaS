import {
  setupCall,
  getSetupDisciplines,
  getCenterDiscipline,
  type SetupScope,
} from "./studio-setup";
export function listProducts(scope: SetupScope, cursor?: string) {
  return setupCall("products_list_v1", {
    org_id: scope.orgId,
    center_id: scope.centerId,
    include_timed_products: true,
    page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
}
export async function productDisciplines(scope: SetupScope) {
  if (!scope.centerId) throw Error("invalidProductScope");
  const all = (await getSetupDisciplines(scope.orgId)).filter((row) => row.state === "active");
  const selected: typeof all = [];
  // Reuse the authoritative center relationship reader; one unresolved relation fails the form.
  for (const row of all) {
    const relation = await getCenterDiscipline(scope.orgId, scope.centerId, row.id);
    if (relation.exists && relation.state === "active") selected.push(row);
  }
  return selected;
}
export function readEntitlements(scope: SetupScope, personId: string) {
  return setupCall("entitlements_get_v1", {
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: personId,
    include_timed_rights: true,
  });
}
