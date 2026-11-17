import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  RequestPersonCreate,
  RequestLeadSave,
  RequestCrmActivitySave,
  RequestLeadConvert,
  RequestPublicApplicationReview,
  CrmPipelineConfiguration,
  LeadPipelineInput,
} from "../../lib/api-contracts/generated";
import { readPerson } from "../people/people";
import { scheduleTimeChoices, ScheduleTimeError } from "../schedule/schedule-time";
import {
  readLeadDetail,
  readLeadActivities,
  readApplicationsPage,
  type LeadDetail,
} from "./leads-read";
import { emptyLeadDraft, type LeadDraft } from "./lead-draft";
type Request<T> = T extends unknown ? Omit<T, "request_id"> : never;
type Application = Awaited<ReturnType<typeof readApplicationsPage>>["items"][number];
type Activity = Awaited<ReturnType<typeof readLeadActivities>>["items"][number];
export type LeadIntent = { scope: ClientScope } & (
  | { operation: "person_create_v1"; request: Request<RequestPersonCreate> }
  | { operation: "lead_save_v1"; request: Request<RequestLeadSave>; before?: LeadDetail }
  | {
      operation: "crm_activity_save_v1";
      request: Request<RequestCrmActivitySave>;
      lead: LeadDetail;
      before?: Activity;
    }
  | { operation: "lead_convert_v1"; request: Request<RequestLeadConvert>; before: LeadDetail }
  | {
      operation: "public_application_review_v1";
      request: Request<RequestPublicApplicationReview>;
      before: Application;
    }
);
const base = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
  operation_key: uuidv7(),
});
function stale() {
  return new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
}
export function leadDraft(before?: LeadDetail): LeadDraft {
  return {
    ...emptyLeadDraft,
    source: before?.values.source ?? "manual",
    interest: before?.values.interest ?? "",
    assignedTo: before?.values.assigned_to ?? "",
    stageKey: before?.values.pipeline?.stage_key ?? "",
    tagKeys: [...(before?.values.pipeline?.tag_keys ?? [])],
    lossReason: before?.values.pipeline?.loss_reason ?? "",
  };
}
export function personIntent(
  scope: ClientScope,
  draft: { name: string; email: string; phone: string },
): LeadIntent {
  const values = z
    .object({
      name: z.string().trim().min(1),
      email: z.union([z.literal(""), z.email()]),
      phone: z.union([z.literal(""), z.string().regex(/^\+[1-9][0-9]{7,14}$/)]),
    })
    .parse({ name: draft.name, email: draft.email.trim(), phone: draft.phone.trim() });
  return {
    scope: { ...scope },
    operation: "person_create_v1",
    request: {
      ...base(scope),
      display_name: values.name,
      contacts: [
        ...(values.email ? [{ kind: "email" as const, value: values.email }] : []),
        ...(values.phone ? [{ kind: "phone" as const, value: values.phone }] : []),
      ],
    },
  };
}
async function freshLead(scope: ClientScope, before: LeadDetail) {
  const current = await readLeadDetail(scope, before.personId, before.id);
  if (current.version !== before.version || current.state !== "open") throw stale();
  return current;
}
function pipelineInput(
  draft: LeadDraft,
  catalog: CrmPipelineConfiguration | undefined,
): LeadPipelineInput | undefined {
  if (!draft.stageKey) {
    if (draft.tagKeys.length || draft.lossReason) throw new Error("LEAD_STAGE_REQUIRED");
    return undefined;
  }
  const stage = catalog?.stages.find((stage) => stage.key === draft.stageKey);
  if (
    !stage ||
    draft.tagKeys.some((key) => !catalog?.tags.some((tag) => tag.key === key)) ||
    new Set(draft.tagKeys).size !== draft.tagKeys.length
  )
    throw new Error("LEAD_CATALOG_CHANGED");
  const reason =
    stage.kind === "lost"
      ? z
          .object({
            lossReason: z.enum(["unreachable", "timing", "price", "alternative", "other"]),
          })
          .parse({ lossReason: draft.lossReason }).lossReason
      : null;
  return { stage_key: stage.key, tag_keys: [...draft.tagKeys], loss_reason: reason };
}
export async function leadSaveIntent(
  scope: ClientScope,
  personId: string,
  draft: LeadDraft,
  catalog: CrmPipelineConfiguration | undefined,
  before?: LeadDetail,
  assignmentWritable = false,
): Promise<LeadIntent> {
  z.uuid().parse(personId);
  const source = z.string().trim().min(1).parse(draft.source),
    interest = z.string().trim().min(1).parse(draft.interest);
  if (before) {
    if (before.personId !== personId) throw new Error("LEAD_PERSON_MISMATCH");
    await freshLead(scope, before);
  }
  const pipeline = pipelineInput(draft, catalog);
  if (!pipeline && before?.values.pipeline) throw new Error("LEAD_STAGE_REQUIRED");
  return {
    scope: { ...scope },
    operation: "lead_save_v1",
    before,
    request: {
      ...base(scope),
      person_id: personId,
      source,
      interest,
      ...(assignmentWritable
        ? { assigned_to: draft.assignedTo ? z.uuid().parse(draft.assignedTo) : null }
        : before
          ? { assigned_to: before.values.assigned_to }
          : {}),
      ...(before
        ? {
            lead_id: before.id,
            expected_version: before.version,
          }
        : {}),
      ...(pipeline ? { pipeline } : {}),
    },
  };
}
export async function leadActivityIntent(
  scope: ClientScope,
  lead: LeadDetail,
  draft: LeadDraft,
  timezone: string,
  before?: Activity,
): Promise<LeadIntent> {
  if (!draft.reviewed) throw new Error("LEAD_REVIEW_REQUIRED");
  await freshLead(scope, lead);
  if (before) {
    const current = await readLeadActivities(scope, lead.id, undefined, before.id);
    if (current.items.length !== 1 || current.items[0].version !== before.version) throw stale();
  }
  let due: string | null = null;
  if (draft.due) {
    const [day, time] = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
        .parse(draft.due)
        .split("T"),
      choices = await scheduleTimeChoices(timezone, day, time);
    const selected = choices.offsets.length
      ? [choices.earlier, choices.later].find((value) => value.offset === draft.dueOffset)
      : choices.earlier;
    if (!selected)
      throw new ScheduleTimeError("SCHEDULE_TIME_AMBIGUOUS", [
        {
          date: day,
          choices: choices.offsets.map((offset) => ({ id: offset, label: `UTC${offset}` })),
        },
      ]);
    due = selected.toInstant().toString();
  }
  if (draft.kind === "followup" && (!due || Date.parse(due) <= Date.now()))
    throw new Error("LEAD_FUTURE_REQUIRED");
  if (!draft.note.trim() && !draft.outcome.trim() && draft.kind !== "followup")
    throw new Error("LEAD_NOTE_REQUIRED");
  return {
    scope: { ...scope },
    operation: "crm_activity_save_v1",
    lead,
    before,
    request: {
      ...base(scope),
      lead_id: lead.id,
      kind: draft.kind,
      due_at: due,
      note: draft.note.trim() || null,
      outcome: draft.outcome.trim() || null,
      ...(before ? { activity_id: before.id, expected_version: before.version } : {}),
    },
  };
}
export async function leadConvertIntent(
  scope: ClientScope,
  before: LeadDetail,
  reviewed: boolean,
): Promise<LeadIntent> {
  if (!reviewed) throw new Error("LEAD_REVIEW_REQUIRED");
  await freshLead(scope, before);
  return {
    scope: { ...scope },
    operation: "lead_convert_v1",
    before,
    request: { ...base(scope), lead_id: before.id },
  };
}
export async function applicationReviewIntent(
  scope: ClientScope,
  before: Application,
  action: "match_existing" | "create_candidate" | "close",
  personId: string | undefined,
  reviewed: boolean,
): Promise<LeadIntent> {
  if (!reviewed) throw new Error("LEAD_REVIEW_REQUIRED");
  const page = await readApplicationsPage(scope, undefined, before.id),
    current = page.items[0];
  if (page.items.length !== 1 || current.version !== before.version || current.state !== "pending")
    throw stale();
  if (action === "match_existing") z.uuid().parse(personId);
  return {
    scope: { ...scope },
    operation: "public_application_review_v1",
    before,
    request: {
      ...base(scope),
      application_id: before.id,
      expected_version: before.version,
      action,
      ...(action === "match_existing" ? { person_id: personId } : {}),
    },
  };
}
export async function writeLeadIntent(intent: LeadIntent) {
  const backend = await scopedBackend(intent.scope),
    request_id = uuidv7();
  switch (intent.operation) {
    case "person_create_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "lead_save_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "crm_activity_save_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "lead_convert_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "public_application_review_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
  }
}
export async function readLeadReceipt(intent: LeadIntent) {
  const backend = await scopedBackend(intent.scope),
    receipt = await backend.call("operation_status_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: intent.scope.orgId,
      operation: intent.operation,
      key: intent.request.operation_key,
    });
  const entity =
    intent.operation === "person_create_v1"
      ? "people"
      : intent.operation === "crm_activity_save_v1"
        ? "crm_activities"
        : intent.operation === "public_application_review_v1"
          ? "public_applications"
          : "leads";
  const expected =
    intent.operation === "public_application_review_v1"
      ? intent.before.id
      : intent.operation === "lead_convert_v1"
        ? intent.before.id
        : intent.operation === "lead_save_v1"
          ? intent.before?.id
          : intent.operation === "crm_activity_save_v1"
            ? intent.before?.id
            : undefined;
  if (
    receipt.operation !== intent.operation ||
    receipt.key !== intent.request.operation_key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== entity ||
        (expected && receipt.result_reference.id !== expected)))
  )
    throw new Error("LEAD_RECEIPT_MISMATCH");
  return receipt;
}
export async function readLeadResult(intent: LeadIntent, id?: string) {
  const primary = z.uuid().parse(id);
  if (intent.operation === "person_create_v1")
    return { kind: "person" as const, person: await readPerson(intent.scope, primary) };
  if (intent.operation === "public_application_review_v1") {
    if (id !== intent.before.id) throw new Error("APPLICATION_RESULT_MISMATCH");
    const page = await readApplicationsPage(intent.scope, undefined, id),
      application = page.items[0];
    if (
      page.items.length !== 1 ||
      application.version <= intent.before.version ||
      application.state !== (intent.request.action === "close" ? "closed" : "reviewed") ||
      (intent.request.action === "match_existing" &&
        application.values.person_id !== intent.request.person_id)
    )
      throw new Error("APPLICATION_RESULT_UNREAD");
    if (intent.request.action !== "close") {
      const personId = z.uuid().parse(application.values.person_id);
      const person = await readPerson(intent.scope, personId);
      if (
        !person.relationships.some(
          (row) =>
            row.center_id === intent.scope.centerId &&
            row.state === "active" &&
            (row.kind === "candidate" || row.kind === "student"),
        )
      )
        throw new Error("APPLICATION_PERSON_UNREAD");
    }
    return { kind: "application" as const, application };
  }
  if (intent.operation === "crm_activity_save_v1") {
    const page = await readLeadActivities(intent.scope, intent.lead.id, undefined, id),
      activity = page.items[0];
    if (
      page.items.length !== 1 ||
      activity.id !== id ||
      activity.values.kind !== intent.request.kind ||
      activity.values.note !== intent.request.note ||
      activity.values.outcome !== intent.request.outcome ||
      (activity.values.due_at ? Date.parse(activity.values.due_at) : null) !==
        (intent.request.due_at ? Date.parse(intent.request.due_at) : null) ||
      (intent.before && activity.version <= intent.before.version)
    )
      throw new Error("ACTIVITY_RESULT_UNREAD");
    return { kind: "activity" as const, activity };
  }
  const personId =
    intent.operation === "lead_save_v1" ? intent.request.person_id : intent.before.personId;
  if (intent.before && intent.before.id !== id) throw new Error("LEAD_RESULT_MISMATCH");
  const detail = await readLeadDetail(intent.scope, personId, id);
  if (intent.operation === "lead_convert_v1") {
    const person = await readPerson(intent.scope, personId);
    if (
      detail.state !== "converted" ||
      detail.version <= intent.before.version ||
      !person.relationships.some(
        (row) =>
          row.center_id === intent.scope.centerId &&
          row.kind === "student" &&
          row.state === "active",
      )
    )
      throw new Error("CONVERSION_RESULT_UNREAD");
  } else {
    const pipeline = intent.request.pipeline,
      actual = detail.values.pipeline;
    if (
      detail.values.source !== intent.request.source ||
      detail.values.interest !== intent.request.interest ||
      (intent.request.assigned_to !== undefined &&
        detail.values.assigned_to !== intent.request.assigned_to) ||
      (intent.before && detail.version <= intent.before.version) ||
      (pipeline &&
        (!actual ||
          actual.stage_key !== pipeline.stage_key ||
          actual.loss_reason !== pipeline.loss_reason ||
          [...actual.tag_keys].sort().join() !== [...pipeline.tag_keys].sort().join()))
    )
      throw new Error("LEAD_RESULT_UNREAD");
  }
  return { kind: "lead" as const, detail };
}
