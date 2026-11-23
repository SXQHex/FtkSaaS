import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
export async function readEntitlementLedger(
  scope: ClientScope,
  personId: string,
  saleId: string,
  cursor?: string,
  readContext?: AccountReadContext,
) {
  z.uuid().parse(personId);
  z.uuid().parse(saleId);
  const backend = await scopedBackend(scope, undefined, readContext);
  const rows = await backend.call("entitlements_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: personId,
    include_timed_rights: true,
    ledger_sale_id: saleId,
    ledger_page: { limit: 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  const matches = rows.filter((row) => row.sale_id === saleId),
    page = matches[0]?.movements;
  if (
    matches.length !== 1 ||
    matches[0].person_id !== personId ||
    !page ||
    page.items.length > 20 ||
    (cursor && page.next_cursor === cursor)
  )
    throw new Error("PROFILE_LEDGER_UNAVAILABLE");
  z.iso.datetime({ offset: true }).parse(page.as_of);
  const ids = new Set<string>();
  for (const row of page.items) {
    z.uuid().parse(row.id);
    z.iso.datetime({ offset: true }).parse(row.created_at);
    z.enum([
      "grant",
      "reserve",
      "consume",
      "release",
      "adjust_add",
      "adjust_subtract",
      "settle_deficit",
      "reverse",
    ]).parse(row.kind);
    z.number().int().safe().parse(row.quantity);
    z.number().int().safe().parse(row.balance_delta);
    z.uuid().parse(row.source.id);
    z.enum(["sales", "reservations", "event_registrations"]).parse(row.source.type);
    if (row.source.type === "sales" && row.source.id !== saleId)
      throw new Error("PROFILE_LEDGER_UNAVAILABLE");
    if (row.previous_id) z.uuid().parse(row.previous_id);
    if (ids.has(row.id)) throw new Error("PROFILE_LEDGER_UNAVAILABLE");
    ids.add(row.id);
  }
  return page;
}
