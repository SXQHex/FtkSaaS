import { validate, v7 } from "uuid";
import type {
  AutomationDefinition,
  AutomationJobView,
  SegmentDefinition,
} from "@ftksaas/api-contracts";
import type { SetupInput, SetupScope } from "./studio-setup";
export const automationWrites = ["segment_save_v1", "automation_save_v1"] as const;
export const automationFields = {
  segment_save_v1: ["scope", "segment_id", "name", "definition", "expected_version"],
  automation_save_v1: ["scope", "automation_id", "definition", "expected_version", "retry_job"],
};
export type AutomationTarget = "center" | "organization";
export function automationSlot(
  kind: "automation" | "segment",
  scope: SetupScope,
  target: AutomationTarget,
  id?: string,
) {
  return `${kind}${target === "organization" ? "-org" : ""}:${id ?? (target === "organization" ? scope.orgId : scope.centerId)}`;
}
export const configurationJournalScope = (
  scope: SetupScope,
  target: AutomationTarget,
): SetupScope =>
  target === "organization" ? { actorId: scope.actorId, orgId: scope.orgId } : scope;
export function configurationInput(scope: SetupScope, target: AutomationTarget) {
  return target === "organization"
    ? { org_id: scope.orgId, scope: { kind: "organization" as const } }
    : {
        org_id: scope.orgId,
        center_id: scope.centerId,
        scope: { kind: "center" as const, center_id: scope.centerId },
      };
}
export type AutomationRecord = {
  configKind?: AutomationTarget;
  id: string;
  version: number;
  definition: AutomationDefinition;
  jobs?: AutomationJobView[];
};
export type SegmentRecord = {
  configKind?: AutomationTarget;
  id: string;
  version: number;
  name: string;
  definition: SegmentDefinition;
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function validSegment(value: unknown): value is SegmentDefinition {
  if (!object(value) || Object.keys(value).some((k) => k !== "all" && k !== "any")) return false;
  const conditions = [
    ...(Array.isArray(value.all) ? value.all : []),
    ...(Array.isArray(value.any) ? value.any : []),
  ];
  if (!Object.keys(value).length || Object.values(value).some((v) => !Array.isArray(v)))
    return false;
  return conditions.every(
    (c) =>
      object(c) &&
      [
        "last_attended_at",
        "entitlement_ends_at",
        "remaining_credits",
        "lead_source",
        "lead_interest",
        "active_student",
        "center_id",
      ].includes(String(c.field)) &&
      ["eq", "neq", "lt", "lte", "gt", "gte", "in", "is_null"].includes(String(c.operator)) &&
      Object.keys(c).every((k) => ["field", "operator", "value"].includes(k)) &&
      (c.operator === "is_null" ||
        (c.operator === "in"
          ? Array.isArray(c.value) && c.value.every((v) => typeof v === "string")
          : typeof c.value === "string" ||
            typeof c.value === "boolean" ||
            (typeof c.value === "number" && Number.isSafeInteger(c.value)))),
  );
}
export function validAutomation(value: unknown, centerId?: string): value is AutomationDefinition {
  if (
    !object(value) ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 10000 ||
    typeof value.enabled !== "boolean" ||
    !object(value.trigger) ||
    !object(value.action)
  )
    return false;
  const t = value.trigger,
    a = value.action;
  return (
    Object.keys(value).every((k) =>
      ["name", "segment_id", "trigger", "action", "execution_center_ids", "enabled"].includes(k),
    ) &&
    (value.segment_id == null ||
      (typeof value.segment_id === "string" && validate(value.segment_id))) &&
    Array.isArray(value.execution_center_ids) &&
    value.execution_center_ids.length > 0 &&
    new Set(value.execution_center_ids).size === value.execution_center_ids.length &&
    value.execution_center_ids.every((id) => typeof id === "string" && validate(id)) &&
    (centerId === undefined ||
      (value.execution_center_ids.length === 1 && value.execution_center_ids[0] === centerId)) &&
    ["entitlement_expiring", "student_inactive", "lead_followup_due"].includes(String(t.kind)) &&
    Number.isSafeInteger(t.offset_days) &&
    Number(t.offset_days) >= 0 &&
    Object.keys(t).every((k) => ["kind", "offset_days"].includes(k)) &&
    ["create_followup", "send_reminder"].includes(String(a.kind)) &&
    a.channel === "in_app" &&
    typeof a.template_key === "string" &&
    !!a.template_key.trim() &&
    a.template_key.length <= 10000 &&
    Object.keys(a).every((k) => ["kind", "channel", "template_key"].includes(k))
  );
}
export function automationCommand(
  scope: SetupScope,
  source: AutomationRecord | null,
  definition: AutomationDefinition,
  retry?: AutomationJobView,
  target: AutomationTarget = source?.configKind ?? "center",
) {
  if (
    !scope.centerId ||
    !validAutomation(definition, target === "center" ? scope.centerId : undefined) ||
    (source &&
      (!validate(source.id) || !Number.isSafeInteger(source.version) || source.version < 1)) ||
    (retry &&
      (!source ||
        retry.state !== "failed" ||
        !retry.retry_available ||
        retry.result_reference ||
        !definition.execution_center_ids.includes(retry.center_id) ||
        !validate(retry.id) ||
        !Number.isSafeInteger(retry.version) ||
        retry.version < 1 ||
        JSON.stringify(source.definition) !== JSON.stringify(definition)))
  )
    throw Error("invalidAutomation");
  return {
    operation: "automation_save_v1" as const,
    input: {
      ...configurationInput(scope, target),
      operation_key: v7(),
      definition,
      ...(source ? { automation_id: source.id, expected_version: source.version } : {}),
      ...(retry ? { retry_job: { id: retry.id, version: retry.version } } : {}),
    },
  };
}
export function validAutomationCommand(
  operation: string,
  input: Record<string, unknown>,
  centerId: string | undefined,
  slot: string,
) {
  if (!object(input.scope)) return false;
  const org = input.scope.kind === "organization";
  if (
    org
      ? input.center_id != null ||
        input.scope.center_id != null ||
        Object.keys(input.scope).some((k) => k !== "kind")
      : !centerId ||
        input.center_id !== centerId ||
        input.scope.kind !== "center" ||
        input.scope.center_id !== centerId ||
        Object.keys(input.scope).some((k) => !["kind", "center_id"].includes(k))
  )
    return false;
  const segment = operation === "segment_save_v1",
    target = segment ? input.segment_id : input.automation_id;
  if (
    (!segment && operation !== "automation_save_v1") ||
    slot !==
      `${segment ? "segment" : "automation"}${org ? "-org" : ""}:${target ?? (org ? input.org_id : centerId)}` ||
    (target != null &&
      (typeof target !== "string" ||
        !validate(target) ||
        !Number.isSafeInteger(input.expected_version) ||
        Number(input.expected_version) < 1)) ||
    (target == null && input.expected_version !== undefined)
  )
    return false;
  if (segment)
    return typeof input.name === "string" && !!input.name.trim() && validSegment(input.definition);
  return (
    validAutomation(input.definition, org ? undefined : centerId) &&
    (input.retry_job === undefined ||
      (target != null &&
        object(input.retry_job) &&
        Object.keys(input.retry_job).length === 2 &&
        typeof input.retry_job.id === "string" &&
        validate(input.retry_job.id) &&
        Number.isSafeInteger(input.retry_job.version) &&
        Number(input.retry_job.version) > 0))
  );
}
export function segmentCommand(
  scope: SetupScope,
  source: SegmentRecord | null,
  name: string,
  definition: SegmentDefinition,
  target: AutomationTarget = source?.configKind ?? "center",
) {
  if (!scope.centerId || !name.trim() || !validSegment(definition))
    throw Error("invalidAutomation");
  const input: SetupInput<"segment_save_v1"> = {
    ...configurationInput(scope, target),
    operation_key: v7(),
    name: name.trim(),
    definition,
    ...(source ? { segment_id: source.id, expected_version: source.version } : {}),
  };
  return { operation: "segment_save_v1" as const, input };
}
