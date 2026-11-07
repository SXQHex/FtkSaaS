import { validate } from "uuid";
import type { EntityVersion, SaleChangeInventoryRecord } from "@ftksaas/api-contracts";
import { setupCall, type SetupScope } from "./studio-setup";
export type ChangeInventory = {
  source: EntityVersion;
  records: ({
    id: string;
    kind: "reservations" | "event_registrations";
    version: number;
  } & SaleChangeInventoryRecord)[];
};
export async function readChangeInventory(
  scope: SetupScope,
  saleId: string,
  personId: string,
): Promise<ChangeInventory> {
  const records: ChangeInventory["records"] = [],
    seen = new Set<string>(),
    cursors = new Set<string>();
  let source: EntityVersion | undefined, cursor: string | undefined;
  do {
    const p = await setupCall("management_state_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation: "sale_change_preview_v1",
        selector: { operation: "sale_change_preview_v1", key: { sale_id: saleId } },
        page: { limit: 200, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
      }),
      s = p.sale_change_context;
    if (
      !s ||
      s.entity.type !== "sales" ||
      s.entity.id !== saleId ||
      !Number.isSafeInteger(s.version) ||
      s.version < 1 ||
      (source && source.version !== s.version) ||
      !Number.isFinite(Date.parse(p.as_of))
    )
      throw Error("invalidSaleChange");
    source = s;
    for (const r of p.items) {
      const d = r.sale_change_record,
        e = r.entity,
        version = r.versions.find(
          (v) => v.entity.id === e?.id && v.entity.type === e?.type,
        )?.version;
      if (
        !r.exists ||
        r.operation !== "sale_change_preview_v1" ||
        r.current?.operation !== "sale_change_preview_v1" ||
        r.current.values.sale_id !== saleId ||
        !d ||
        d.person_id !== personId ||
        !validate(d.center_id) ||
        !e ||
        !["reservations", "event_registrations"].includes(e.type) ||
        !validate(e.id) ||
        !version ||
        seen.has(e.id) ||
        Date.parse(d.starts_at) < Date.parse(p.as_of) ||
        !Number.isFinite(Date.parse(d.starts_at)) ||
        d.parent.type !== (e.type === "reservations" ? "sessions" : "events") ||
        !r.versions.some(
          (v) => v.entity.id === d.parent.id && v.entity.type === d.parent.type && v.version > 0,
        ) ||
        !r.versions.some(
          (v) => v.entity.type === "sales" && v.entity.id === saleId && v.version === s.version,
        )
      )
        throw Error("invalidSaleChange");
      seen.add(e.id);
      records.push({
        id: e.id,
        kind: e.type as "reservations" | "event_registrations",
        version,
        ...d,
      });
    }
    cursor = p.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw Error("invalidSaleChange");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return { source: source!, records };
}
export function partitionChange(inventory: ChangeInventory, choices: Record<string, string>) {
  if (
    inventory.records.some((r) => r.kind === "event_registrations") ||
    Object.keys(choices).length !== inventory.records.length ||
    inventory.records.some((r) => !["keep", "cancel"].includes(choices[r.id] ?? ""))
  )
    throw Error("invalidSaleChange");
  return {
    keep_reservation_ids: inventory.records
      .filter((r) => choices[r.id] === "keep")
      .map((r) => r.id),
    cancel_reservation_ids: inventory.records
      .filter((r) => choices[r.id] === "cancel")
      .map((r) => r.id),
  };
}
