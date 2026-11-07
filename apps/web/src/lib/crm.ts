import { validate } from "uuid";
import type {
  ManagementSelector,
  ManagementProjection,
  FollowupKind,
  LeadView,
} from "@ftksaas/api-contracts";
import { setupCall, type SetupScope } from "./studio-setup";
export function sourceVersion(row: {
  entity: { type: string; id: string } | null;
  versions: { entity: { type: string; id: string }; version: number }[];
}) {
  const v = row.versions.find(
    (v) => v.entity.id === row.entity?.id && v.entity.type === row.entity.type,
  )?.version;
  if (!v || !Number.isSafeInteger(v) || v < 1) throw Error("invalidCrm");
  return v;
}
export const crmApi = {
  async leads(scope: SetupScope, query: string, cursor?: string) {
    const p = await setupCall("leads_list_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      query: query || undefined,
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    if (
      new Set(p.items.map((r) => r.id)).size !== p.items.length ||
      p.items.some(
        (r) =>
          !validate(r.id) ||
          !validate(r.person_id) ||
          !Number.isSafeInteger(r.version) ||
          r.version < 1,
      ) ||
      (cursor && cursor === p.next_cursor)
    )
      throw Error("invalidCrm");
    return p;
  },
  async management(scope: SetupScope, selector: ManagementSelector, cursor?: string) {
    const p = await setupCall("management_state_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: selector.operation,
      selector,
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    const ids = new Set();
    for (const row of p.items) {
      if (
        row.operation !== selector.operation ||
        row.current?.operation !== selector.operation ||
        !row.entity ||
        !validate(row.entity.id) ||
        ids.has(row.entity.id)
      )
        throw Error("invalidCrm");
      ids.add(row.entity.id);
      sourceVersion(row);
      const values = row.current.values;
      for (const [k, v] of Object.entries(selector.key))
        if (v !== undefined && v !== null && (!(k in values) || Reflect.get(values, k) !== v))
          throw Error("invalidCrm");
    }
    if (cursor && p.next_cursor === cursor) throw Error("invalidCrm");
    return p;
  },
  async followups(scope: SetupScope, kind: FollowupKind, cursor?: string) {
    const p = await setupCall("crm_followup_list_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      kind,
      page: { limit: 25, sort: "due_at_asc", ...(cursor ? { cursor } : {}) },
    });
    if (
      p.items.some(
        (r) =>
          r.center_id !== scope.centerId ||
          r.kind !== kind ||
          !validate(r.id) ||
          !validate(r.person_id) ||
          !Number.isFinite(Date.parse(r.due_at)),
      ) ||
      new Set(p.items.map((r) => r.id)).size !== p.items.length ||
      (cursor && p.next_cursor === cursor)
    )
      throw Error("invalidCrm");
    return p;
  },
  async lead(scope: SetupScope, personId: string, leadId: string): Promise<LeadRecord> {
    const p = await crmApi.management(scope, {
      operation: "lead_save_v1",
      key: { person_id: personId, lead_id: leadId },
    });
    const row = p.items.find((r) => r.entity?.id === leadId),
      v = row?.current?.operation === "lead_save_v1" ? row.current.values : undefined;
    if (
      !row ||
      !v ||
      v.person_id !== personId ||
      v.lead_id !== leadId ||
      typeof v.source !== "string" ||
      typeof v.interest !== "string" ||
      !(v.assigned_to === null || (typeof v.assigned_to === "string" && validate(v.assigned_to))) ||
      !["open", "converted", "closed"].includes(row.state ?? "")
    )
      throw Error("invalidCrm");
    return {
      id: leadId,
      person_id: personId,
      source: v.source,
      interest: v.interest,
      assigned_to: v.assigned_to,
      state: row.state as LeadRecord["state"],
      version: sourceVersion(row),
    };
  },
  people: (scope: SetupScope, query: string, cursor?: string) =>
    setupCall("people_list_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      query: query || undefined,
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    }),
};
export type CrmProjection<K extends ManagementProjection["operation"]> = Extract<
  ManagementProjection,
  { operation: K }
>["values"];

export type LeadRecord = Pick<
  LeadView,
  | "id"
  | "person_id"
  | "source"
  | "interest"
  | "assigned_to"
  | "state"
  | "version"
  | "subscriber_number"
>;
