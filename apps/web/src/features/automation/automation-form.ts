import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import type { AutomationDefinition, SegmentDefinition } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import type { AutomationDraft, SegmentDraft } from "./automation-draft";
import { emptyAutomationDraft } from "./automation-draft";
import type { AutomationRecord, SegmentRecord } from "./automation";
export function automationDraft(before?: AutomationRecord): AutomationDraft {
  if (!before) return { ...emptyAutomationDraft, recipients: [] };
  const d = before.definition;
  return {
    name: d.name,
    segmentId: d.segment_id ?? "__none__",
    trigger: d.trigger.kind,
    action:
      d.action.channel === "email"
        ? "email"
        : d.action.kind === "create_followup"
          ? "followup"
          : "inbox",
    template: d.action.kind === "send_reminder" ? d.action.template_key : "",
    text: d.action.kind === "create_followup" ? d.action.template_key : "",
    enabled: d.enabled,
    offsetDays: String(d.trigger.offset_days),
    recipients: [...(d.trigger.recipient_person_ids ?? [])],
    assignee: "",
  };
}
export function automationDefinition(
  scope: ClientScope,
  draft: AutomationDraft,
  before?: AutomationRecord,
  preparedKey?: string,
): AutomationDefinition {
  const kind = z
    .enum([
      "entitlement_expiring",
      "student_inactive",
      "lead_followup_due",
      "pending_request",
      "unclosed_attendance",
    ])
    .parse(draft.trigger);
  if (!["followup", "inbox"].includes(draft.action)) throw Error("AUTOMATION_ACTION_UNAVAILABLE");
  const sourceKey =
    preparedKey ??
    (before?.definition.action.kind === "send_reminder" &&
    before.definition.action.channel === "in_app"
      ? before.definition.action.template_key
      : undefined);
  if (draft.action === "inbox" && (!sourceKey || sourceKey !== draft.template))
    throw Error("AUTOMATION_TEMPLATE_UNAVAILABLE");
  if (["pending_request", "unclosed_attendance"].includes(kind) && draft.segmentId !== "__none__")
    throw Error("AUTOMATION_INVALID");
  const recipients = z.array(z.uuid()).max(50).parse(draft.recipients);
  if (new Set(recipients).size !== recipients.length) throw Error("AUTOMATION_INVALID");
  return {
    name: z.string().trim().min(1).parse(draft.name),
    segment_id: draft.segmentId === "__none__" ? null : z.uuid().parse(draft.segmentId),
    trigger: {
      kind,
      offset_days: z.coerce
        .number()
        .int()
        .nonnegative()
        .safe()
        .parse(z.string().regex(/^\d+$/).parse(draft.offsetDays)),
      ...(recipients.length ? { recipient_person_ids: recipients as [string, ...string[]] } : {}),
    },
    action: {
      kind: draft.action === "followup" ? "create_followup" : "send_reminder",
      channel: "in_app",
      template_key:
        draft.action === "followup" ? z.string().trim().min(1).parse(draft.text) : sourceKey!,
    },
    execution_center_ids: before ? [...before.definition.execution_center_ids] : [scope.centerId],
    enabled: draft.enabled,
  };
}
export function segmentDraft(before?: SegmentRecord): SegmentDraft | undefined {
  if (!before) return { name: "", conditions: [] };
  if (before.definition.any?.length) return undefined;
  const rows = before.definition.all ?? [];
  if (
    rows.some(
      (row) =>
        !(row.field === "active_student" && row.operator === "eq" && row.value === true) &&
        !(
          row.field === "remaining_credits" &&
          row.operator === "lte" &&
          typeof row.value === "number"
        ),
    )
  )
    return undefined;
  const values = rows.filter((row) => row.field === "remaining_credits");
  if (values.length !== 1) return undefined;
  return {
    name: before.name,
    conditions: [{ id: uuidv7(), kind: "remaining", value: String(values[0]!.value) }],
  };
}
export function segmentDefinition(draft: SegmentDraft, before?: SegmentRecord): SegmentDefinition {
  if (before && !segmentDraft(before)) throw Error("AUTOMATION_CONDITION_UNAVAILABLE");
  if (draft.conditions.length !== 1 || draft.conditions[0]!.kind !== "remaining")
    throw Error("AUTOMATION_CONDITION_UNAVAILABLE");
  const value = z.coerce
    .number()
    .int()
    .nonnegative()
    .safe()
    .parse(z.string().regex(/^\d+$/).parse(draft.conditions[0]!.value));
  // Existing definitions retain their active-student semantics; a new segment explicitly matches active members only.
  return {
    all: [
      ...(!before ||
      (before.definition.all ?? []).some(
        (row) => row.field === "active_student" && row.operator === "eq" && row.value === true,
      )
        ? [{ field: "active_student" as const, operator: "eq" as const, value: true }]
        : []),
      { field: "remaining_credits", operator: "lte", value },
    ],
  };
}
