import { readKnownAutomationJob } from "./automation-discovery";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type {
  AutomationDefinition,
  AutomationJobView,
  SegmentDefinition,
  RequestAutomationSave,
  RequestSegmentSave,
  ManagementSelector,
} from "@ftksaas/api-contracts";
const count = z.number().int().nonnegative().safe(),
  version = z.number().int().positive().safe();
const condition = z.object({
  field: z.enum([
    "last_attended_at",
    "entitlement_ends_at",
    "remaining_credits",
    "lead_source",
    "lead_interest",
    "active_student",
    "center_id",
  ]),
  operator: z.enum(["eq", "neq", "lt", "lte", "gt", "gte", "in", "is_null"]),
  value: z.union([z.string(), z.number().finite(), z.boolean(), z.array(z.string())]).optional(),
});
const segmentDefinition = z.object({
  all: z.array(condition).optional(),
  any: z.array(condition).optional(),
});
const definition = z.object({
  name: z.string().trim().min(1),
  segment_id: z.uuid().nullish(),
  trigger: z.object({
    kind: z.enum([
      "entitlement_expiring",
      "student_inactive",
      "lead_followup_due",
      "pending_request",
      "unclosed_attendance",
    ]),
    offset_days: count,
    recipient_person_ids: z.array(z.uuid()).min(1).max(50).optional(),
  }),
  action: z.object({
    kind: z.enum(["create_followup", "send_reminder"]),
    channel: z.enum(["in_app", "email"]),
    template_key: z.string().trim().min(1),
  }),
  execution_center_ids: z.array(z.uuid()).min(1),
  enabled: z.boolean(),
});
const job = z.object({
  id: z.uuid(),
  version,
  center_id: z.uuid(),
  person_id: z.uuid(),
  state: z.enum(["pending", "running", "retry_wait", "succeeded", "failed", "cancelled"]),
  attempts: count,
  next_attempt_at: z.iso.datetime({ offset: true }).nullable(),
  safe_error_code: z.string().nullable(),
  result_reference: z.object({ type: z.string(), id: z.uuid() }).nullable(),
  retry_available: z.boolean(),
});
export interface SegmentRecord {
  id: string;
  version: number;
  state: string;
  name: string;
  definition: SegmentDefinition;
}
export interface AutomationRecord {
  id: string;
  version: number;
  state: string;
  definition: AutomationDefinition;
  jobs: AutomationJobView[] | undefined;
}
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
const configurationScope = (scope: ClientScope) => ({
  kind: "center" as const,
  center_id: scope.centerId,
});
async function readPage(
  scope: ClientScope,
  selector: ManagementSelector,
  cursor?: string,
  context?: AccountReadContext,
) {
  return (await scopedBackend(scope, undefined, context)).call("management_state_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
    operation: selector.operation,
    selector,
    page: { limit: 20, ...(cursor ? { cursor } : {}) },
  });
}
export async function readSegments(
  scope: ClientScope,
  id?: string,
  cursor?: string,
  context?: AccountReadContext,
) {
  const page = await readPage(
      scope,
      {
        operation: "segment_save_v1",
        key: {
          scope: configurationScope(scope),
          ...(id ? { segment_id: z.uuid().parse(id) } : {}),
        },
      },
      cursor,
      context,
    ),
    seen = new Set<string>();
  const items = page.items.map((row) => {
    const current = row.current?.operation === "segment_save_v1" ? row.current.values : undefined,
      entity = row.entity,
      versions = row.versions.filter(
        (v) => v.entity.type === "segments" && v.entity.id === entity?.id,
      );
    if (
      !row.exists ||
      row.operation !== "segment_save_v1" ||
      entity?.type !== "segments" ||
      !entity.id ||
      seen.has(entity.id) ||
      versions.length !== 1 ||
      !current?.definition ||
      current.segment_id !== entity.id ||
      current.scope?.kind !== "center" ||
      current.scope.center_id !== scope.centerId ||
      !current.name ||
      (id && entity.id !== id)
    )
      throw Error("AUTOMATION_SOURCE_UNAVAILABLE");
    seen.add(z.uuid().parse(entity.id));
    segmentDefinition.parse(current.definition);
    return {
      id: entity.id,
      version: version.parse(versions[0]!.version),
      state: row.state ?? "",
      name: current.name,
      definition: current.definition,
    } satisfies SegmentRecord;
  });
  return { items, next_cursor: page.next_cursor };
}
export async function readAutomations(
  scope: ClientScope,
  id?: string,
  cursor?: string,
  context?: AccountReadContext,
) {
  const page = await readPage(
      scope,
      {
        operation: "automation_save_v1",
        key: {
          scope: configurationScope(scope),
          ...(id ? { automation_id: z.uuid().parse(id) } : {}),
        },
      },
      cursor,
      context,
    ),
    seen = new Set<string>();
  const items = page.items.map((row) => {
    const current =
        row.current?.operation === "automation_save_v1" ? row.current.values : undefined,
      entity = row.entity,
      versions = row.versions.filter(
        (v) => v.entity.type === "automations" && v.entity.id === entity?.id,
      );
    if (
      !row.exists ||
      row.operation !== "automation_save_v1" ||
      entity?.type !== "automations" ||
      !entity.id ||
      seen.has(entity.id) ||
      versions.length !== 1 ||
      !current?.definition ||
      current.automation_id !== entity.id ||
      current.scope?.kind !== "center" ||
      current.scope.center_id !== scope.centerId ||
      (id && entity.id !== id)
    )
      throw Error("AUTOMATION_SOURCE_UNAVAILABLE");
    seen.add(z.uuid().parse(entity.id));
    definition.parse(current.definition);
    if (current.recent_jobs !== undefined) {
      if (current.recent_jobs.length > 20) throw Error("AUTOMATION_JOBS_UNAVAILABLE");
      const ids = new Set<string>();
      for (const value of current.recent_jobs) {
        job.parse(value);
        if (value.center_id !== scope.centerId || ids.has(value.id))
          throw Error("AUTOMATION_JOBS_UNAVAILABLE");
        ids.add(value.id);
      }
    }
    return {
      id: entity.id,
      version: version.parse(versions[0]!.version),
      state: row.state ?? "",
      definition: current.definition,
      jobs: current.recent_jobs,
    } satisfies AutomationRecord;
  });
  return { items, next_cursor: page.next_cursor };
}
async function segmentAt(scope: ClientScope, id: string) {
  const page = await readSegments(scope, id);
  if (page.items.length !== 1 || page.next_cursor) throw Error("AUTOMATION_SOURCE_UNAVAILABLE");
  return page.items[0]!;
}
export async function automationAt(scope: ClientScope, id: string) {
  const page = await readAutomations(scope, id);
  if (page.items.length !== 1 || page.next_cursor) throw Error("AUTOMATION_SOURCE_UNAVAILABLE");
  return page.items[0]!;
}
const conflict = () =>
  new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
export type AutomationIntent =
  | {
      operation: "automation_save_v1";
      scope: ClientScope;
      request: Omit<RequestAutomationSave, "request_id">;
      before?: AutomationRecord;
      retry?: AutomationJobView;
    }
  | {
      operation: "segment_save_v1";
      scope: ClientScope;
      request: Omit<RequestSegmentSave, "request_id">;
      before?: SegmentRecord;
    };
export async function segmentIntent(
  scope: ClientScope,
  name: string,
  value: SegmentDefinition,
  reviewed: boolean,
  before?: SegmentRecord,
): Promise<AutomationIntent> {
  if (!reviewed) throw Error("AUTOMATION_REVIEW_REQUIRED");
  z.string().trim().min(1).parse(name);
  segmentDefinition.parse(value);
  const conditions = [...(value.all ?? []), ...(value.any ?? [])];
  if (
    !conditions.length ||
    conditions.some((row) => row.operator !== "is_null" && row.value === undefined)
  )
    throw Error("AUTOMATION_INVALID");
  if (before) {
    const current = await segmentAt(scope, before.id);
    if (current.version !== before.version) throw conflict();
  }
  return {
    operation: "segment_save_v1",
    scope: { ...scope },
    ...(before ? { before: structuredClone(before) } : {}),
    request: {
      ...common(scope),
      operation_key: uuidv7(),
      scope: configurationScope(scope),
      name: name.trim(),
      definition: structuredClone(value),
      ...(before ? { segment_id: before.id, expected_version: before.version } : {}),
    },
  };
}
export async function automationIntent(
  scope: ClientScope,
  value: AutomationDefinition,
  reviewed: boolean,
  before?: AutomationRecord,
  retry?: AutomationJobView,
): Promise<AutomationIntent> {
  if (!reviewed) throw Error("AUTOMATION_REVIEW_REQUIRED");
  definition.parse(value);
  if (
    value.execution_center_ids.some((id) => id !== scope.centerId) ||
    new Set(value.execution_center_ids).size !== value.execution_center_ids.length
  )
    throw Error("AUTOMATION_INVALID");
  if (
    value.action.channel !== "in_app" ||
    (value.action.kind !== "create_followup" && value.action.kind !== "send_reminder")
  )
    throw Error("AUTOMATION_ACTION_UNAVAILABLE");
  if (
    ["pending_request", "unclosed_attendance"].includes(value.trigger.kind) &&
    (value.action.kind !== "send_reminder" ||
      !value.trigger.recipient_person_ids?.length ||
      value.segment_id != null)
  )
    throw Error("AUTOMATION_INVALID");
  if (before) {
    const current = await automationAt(scope, before.id);
    if (current.version !== before.version) throw conflict();
    if (retry) {
      const actual =
        retry.automation_id && retry.created_at
          ? await readKnownAutomationJob(scope, retry)
          : current.jobs?.find((row) => row.id === retry.id);
      if (
        !actual ||
        actual.version !== retry.version ||
        (actual.automation_id !== undefined && actual.automation_id !== current.id) ||
        (actual.automation_version !== undefined &&
          actual.automation_version !== current.version) ||
        !actual.retry_available ||
        actual.result_reference !== null ||
        !current.definition.enabled ||
        current.state !== "active" ||
        actual.state !== "failed" ||
        !sameDefinition(current.definition, value)
      )
        throw conflict();
    }
  } else if (retry) throw Error("AUTOMATION_INVALID");
  return {
    operation: "automation_save_v1",
    scope: { ...scope },
    ...(before ? { before: structuredClone(before) } : {}),
    ...(retry ? { retry: structuredClone(retry) } : {}),
    request: {
      ...common(scope),
      operation_key: uuidv7(),
      scope: configurationScope(scope),
      definition: structuredClone(value),
      ...(before ? { automation_id: before.id, expected_version: before.version } : {}),
      ...(retry ? { retry_job: { id: retry.id, version: retry.version } } : {}),
    },
  };
}
function sameDefinition(a: AutomationDefinition, b: AutomationDefinition) {
  return (
    a.name === b.name &&
    (a.segment_id ?? null) === (b.segment_id ?? null) &&
    a.enabled === b.enabled &&
    a.trigger.kind === b.trigger.kind &&
    a.trigger.offset_days === b.trigger.offset_days &&
    JSON.stringify(a.trigger.recipient_person_ids ?? []) ===
      JSON.stringify(b.trigger.recipient_person_ids ?? []) &&
    a.action.kind === b.action.kind &&
    a.action.channel === b.action.channel &&
    a.action.template_key === b.action.template_key &&
    JSON.stringify(a.execution_center_ids) === JSON.stringify(b.execution_center_ids)
  );
}
function sameSegment(a: SegmentDefinition, b: SegmentDefinition) {
  return (["all", "any"] as const).every((key) => {
    const left = a[key] ?? [],
      right = b[key] ?? [];
    return (
      left.length === right.length &&
      left.every(
        (condition, index) =>
          condition.field === right[index]!.field &&
          condition.operator === right[index]!.operator &&
          JSON.stringify(condition.value) === JSON.stringify(right[index]!.value),
      )
    );
  });
}
export async function writeAutomation(intent: AutomationIntent) {
  const backend = await scopedBackend(intent.scope);
  if (intent.operation === "automation_save_v1")
    return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
}
export async function readAutomationReceipt(intent: AutomationIntent) {
  const expected = intent.operation === "automation_save_v1" ? "automations" : "segments",
    value = await (
      await scopedBackend(intent.scope)
    ).call("operation_status_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: intent.scope.orgId,
      operation: intent.operation,
      key: intent.request.operation_key,
    });
  if (
    value.operation !== intent.operation ||
    value.key !== intent.request.operation_key ||
    (value.result_reference &&
      (value.result_reference.type !== expected ||
        (intent.before && value.result_reference.id !== intent.before.id)))
  )
    throw Error("AUTOMATION_RECEIPT_UNAVAILABLE");
  return value;
}
export async function readAutomationResult(intent: AutomationIntent, id?: string) {
  const target = z.uuid().parse(id);
  if (intent.before && target !== intent.before.id) throw Error("AUTOMATION_RESULT_UNREAD");
  if (intent.operation === "segment_save_v1") {
    const value = await segmentAt(intent.scope, target);
    if (
      (intent.before && value.version <= intent.before.version) ||
      value.name !== intent.request.name ||
      !sameSegment(value.definition, intent.request.definition)
    )
      throw Error("AUTOMATION_RESULT_UNREAD");
    return value;
  }
  const value = await automationAt(intent.scope, target);
  if (!sameDefinition(value.definition, intent.request.definition))
    throw Error("AUTOMATION_RESULT_UNREAD");
  if (intent.retry) {
    const job =
      intent.retry.automation_id && intent.retry.created_at
        ? await readKnownAutomationJob(intent.scope, intent.retry)
        : value.jobs?.find((row) => row.id === intent.retry!.id);
    if (value.version !== intent.before!.version || !job || job.version <= intent.retry.version)
      throw Error("AUTOMATION_RESULT_UNREAD");
  } else if (intent.before && value.version <= intent.before.version)
    throw Error("AUTOMATION_RESULT_UNREAD");
  return value;
}
export async function readAutomationPreparations(scope: ClientScope, context?: AccountReadContext) {
  const catalog = await (
    await scopedBackend(scope, undefined, context)
  ).call("settings_catalog_get_v1", { ...common(scope), request_id: uuidv7(), scope: "center" });
  if (catalog.scope !== "center") throw Error("AUTOMATION_TEMPLATE_UNAVAILABLE");
  return catalog.preparation_templates?.automations;
}
export async function resolveAutomationPreparation(
  scope: ClientScope,
  source: import("@ftksaas/api-contracts").PreparationSourceReference,
) {
  const result = await (
    await scopedBackend(scope)
  ).call("settings_preparation_resolve_v1", {
    ...common(scope),
    request_id: uuidv7(),
    kind: "automation",
    source,
  });
  if (
    result.kind !== "automation" ||
    result.source.key !== source.key ||
    result.source.scope !== source.scope ||
    result.source.version !== source.version ||
    result.source.center_id !== source.center_id
  )
    throw Error("AUTOMATION_TEMPLATE_UNAVAILABLE");
  return result;
}
