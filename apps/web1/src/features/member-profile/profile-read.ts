import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  EntitlementView,
  ProductView,
  DisciplineView,
} from "../../lib/api-contracts/generated";
import { getTemporal } from "../../lib/temporal";
import { readProductsPage } from "../products/products";

export async function readProfileRights(
  scope: ClientScope,
  personId: string,
): Promise<EntitlementView[]> {
  z.uuid().parse(personId);
  const backend = await scopedBackend(scope);
  const rows = await backend.call("entitlements_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: personId,
    include_timed_rights: true,
  });
  const ids = new Set<string>(),
    T = await getTemporal();
  for (const row of rows) {
    z.uuid().parse(row.sale_id);
    if (row.person_id !== personId || ids.has(row.sale_id))
      throw new Error("PROFILE_RIGHTS_SOURCE_UNAVAILABLE");
    ids.add(row.sale_id);
    T.PlainDate.from(row.start_date);
    T.PlainDate.from(row.end_date);
    T.Now.instant().toZonedDateTimeISO(row.timezone);
    for (const field of ["available", "reserved", "consumed", "deficit"] as const)
      z.number().int().nonnegative().safe().parse(row[field]);
    if (row.product_version_id) z.uuid().parse(row.product_version_id);
    for (const quota of row.quotas) {
      z.iso.datetime({ offset: true }).parse(quota.starts_at);
      z.iso.datetime({ offset: true }).parse(quota.ends_at);
      for (const n of [quota.limit, quota.reserved, quota.consumed])
        z.number().int().nonnegative().safe().parse(n);
    }
  }
  return rows;
}
export async function readProfileCatalog(scope: ClientScope): Promise<ProductView[]> {
  const rows: ProductView[] = [],
    cursors = new Set<string>(),
    ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await readProductsPage(scope, cursor);
    for (const row of page.items) {
      if (ids.has(row.id)) throw new Error("PROFILE_PRODUCT_SOURCE_UNAVAILABLE");
      ids.add(row.id);
      rows.push(row);
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw new Error("PROFILE_PRODUCT_SOURCE_UNAVAILABLE");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return rows;
}

export async function readProfileDisciplines(scope: ClientScope): Promise<DisciplineView[]> {
  const backend = await scopedBackend(scope),
    rows: DisciplineView[] = [],
    ids = new Set<string>(),
    cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await backend.call("disciplines_list_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    });
    for (const row of page.items) {
      z.uuid().parse(row.id);
      if (ids.has(row.id)) throw new Error("PROFILE_DISCIPLINE_SOURCE_UNAVAILABLE");
      ids.add(row.id);
      rows.push(row);
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw new Error("PROFILE_DISCIPLINE_SOURCE_UNAVAILABLE");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return rows;
}
