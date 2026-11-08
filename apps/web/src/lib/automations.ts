import { setupCall, type SetupScope } from "./studio-setup";
import { sourceVersion } from "./crm";
import {
  validAutomation,
  validSegment,
  type AutomationRecord,
  type SegmentRecord,
  type AutomationTarget,
} from "./automation-command";
import { validate } from "uuid";
export async function readAutomations(
  scope: SetupScope,
  kind: "automation" | "segment",
  cursor?: string,
  target: AutomationTarget = "center",
) {
  if (!scope.centerId) throw Error("invalidAutomation");
  const selector =
    kind === "automation"
      ? {
          operation: "automation_save_v1" as const,
          key: {
            scope:
              target === "center"
                ? { kind: "center" as const, center_id: scope.centerId }
                : { kind: "organization" as const },
          },
        }
      : {
          operation: "segment_save_v1" as const,
          key: {
            scope:
              target === "center"
                ? { kind: "center" as const, center_id: scope.centerId }
                : { kind: "organization" as const },
          },
        };
  const page = await setupCall("management_state_get_v1", {
    org_id: scope.orgId,
    ...(target === "center" ? { center_id: scope.centerId } : {}),
    operation: selector.operation,
    selector,
    page: { limit: 25, ...(cursor ? { cursor } : {}) },
  });
  const automations: AutomationRecord[] = [],
    segments: SegmentRecord[] = [],
    ids = new Set();
  for (const row of page.items) {
    if (
      !row.exists ||
      !row.entity ||
      row.entity.type !== (kind === "automation" ? "automations" : "segments") ||
      !validate(row.entity.id) ||
      ids.has(row.entity.id) ||
      row.operation !== selector.operation ||
      !(
        row.current?.operation === "automation_save_v1" ||
        row.current?.operation === "segment_save_v1"
      ) ||
      row.current.values.scope?.kind !== target ||
      (target === "center" && row.current.values.scope.center_id !== scope.centerId)
    )
      throw Error("invalidAutomation");
    ids.add(row.entity.id);
    const version = sourceVersion(row);
    if (row.current?.operation === "automation_save_v1") {
      const v = row.current.values;
      if (
        kind !== "automation" ||
        v.automation_id !== row.entity.id ||
        !validAutomation(v.definition, target === "center" ? scope.centerId : undefined)
      )
        throw Error("invalidAutomation");
      const jobs = v.recent_jobs ?? [];
      if (
        jobs.some(
          (j) =>
            !validate(j.center_id) ||
            (j.retry_available && !v.definition!.execution_center_ids.includes(j.center_id)) ||
            !validate(j.id) ||
            !validate(j.person_id) ||
            !Number.isSafeInteger(j.version) ||
            j.version < 1 ||
            (j.retry_available && (j.state !== "failed" || j.result_reference !== null)),
        )
      )
        throw Error("invalidAutomation");
      automations.push({
        id: row.entity.id,
        version,
        definition: v.definition,
        jobs,
        configKind: target,
      });
    } else if (row.current?.operation === "segment_save_v1") {
      const v = row.current.values;
      if (
        kind !== "segment" ||
        v.segment_id !== row.entity.id ||
        !v.name ||
        !validSegment(v.definition)
      )
        throw Error("invalidAutomation");
      segments.push({
        id: row.entity.id,
        version,
        name: v.name,
        definition: v.definition,
        configKind: target,
      });
    } else throw Error("invalidAutomation");
  }
  if (cursor && page.next_cursor === cursor) throw Error("invalidAutomation");
  return { automations, segments, next: page.next_cursor };
}
