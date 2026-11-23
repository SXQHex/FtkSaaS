import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { BackendError, queryBackendRead } from "../../lib/backend";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type { ManagementWorkView } from "@ftksaas/api-contracts";
import { requestDetail } from "../lesson-requests/lesson-requests-read";
import { readEvent } from "../events/events-read";

export const overviewWorkKey = (scope: ClientScope) =>
  ["overview-work", scope.accountId, scope.orgId, scope.centerId] as const;

const positive = z.number().int().positive().safe(),
  count = z.number().int().nonnegative().safe(),
  instant = z.iso.datetime({ offset: true });
function checkTask(task: ManagementWorkView) {
  z.uuid().parse(task.id);
  positive.parse(task.version);
  instant.parse(task.created_at);
  z.string().min(1).parse(task.title);
  if (task.person_id !== null) z.uuid().parse(task.person_id);
  if (task.due_at !== null) {
    instant.parse(task.due_at);
    if (task.kind !== "crm_followup") throw Error("WORK_SOURCE_UNAVAILABLE");
  }
  const target = task.target;
  if (
    task.kind === "lesson_attendance" &&
    target.operation === "session_get_v1" &&
    target.session_id === task.id
  )
    return;
  if (
    task.kind === "event_attendance" &&
    target.operation === "event_get_v1" &&
    target.event_id === task.id
  )
    return;
  if (target.operation !== "management_state_get_v1") throw Error("WORK_SOURCE_UNAVAILABLE");
  const selector = target.selector;
  if (
    task.kind === "lesson_request" &&
    selector.operation === "lesson_request_create_v1" &&
    selector.key.lesson_request_id === task.id &&
    !selector.key.catalog
  )
    return;
  if (
    task.kind === "application_review" &&
    selector.operation === "public_application_review_v1" &&
    selector.key.application_id === task.id
  )
    return;
  if (
    task.kind === "crm_followup" &&
    selector.operation === "crm_activity_save_v1" &&
    selector.key.activity_id === task.id &&
    !selector.key.directory
  ) {
    if (!!selector.key.lead_id === !!selector.key.person_id) throw Error("WORK_SOURCE_UNAVAILABLE");
    z.uuid().parse(selector.key.lead_id || selector.key.person_id);
    return;
  }
  throw Error("WORK_SOURCE_UNAVAILABLE");
}
export async function readOverviewWork(
  scope: ClientScope,
  cursor?: string,
  limit = 20,
  context?: AccountReadContext,
  signal = context?.signal,
) {
  const backend = await scopedBackend(scope, signal, context);
  const page = await queryBackendRead(
    backend,
    "management_work_list_v1",
    {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      kind: "all",
      page: { limit, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    },
    signal,
  );
  instant.parse(page.as_of);
  const seen = new Set<string>();
  for (const row of page.items) {
    checkTask(row);
    const key = `${row.kind}:${row.id}`;
    if (seen.has(key)) throw Error("WORK_SOURCE_UNAVAILABLE");
    seen.add(key);
  }
  if (page.items.length > limit || (cursor && page.next_cursor === cursor))
    throw Error("WORK_CURSOR_UNAVAILABLE");
  for (const value of Object.values(page.summary)) count.parse(value);
  if (
    page.summary.total < page.items.length ||
    page.summary.total !==
      page.summary.lesson_request +
        page.summary.lesson_attendance +
        page.summary.event_attendance +
        page.summary.crm_followup +
        page.summary.application_review
  )
    throw Error("WORK_SOURCE_UNAVAILABLE");
  return page;
}
async function readManagement(
  scope: ClientScope,
  task: ManagementWorkView,
  context?: AccountReadContext,
) {
  checkTask(task);
  if (task.target.operation !== "management_state_get_v1") throw Error("WORK_SOURCE_UNAVAILABLE");
  const selector = task.target.selector;
  const page = await (
    await scopedBackend(scope, undefined, context)
  ).call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: selector.operation,
    selector,
    page: { limit: 1 },
  });
  const row = page.items[0],
    type =
      task.kind === "lesson_request"
        ? "lesson_requests"
        : task.kind === "crm_followup"
          ? "crm_activities"
          : "public_applications";
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !row?.exists ||
    row.operation !== selector.operation ||
    row.entity?.type !== type ||
    row.entity.id !== task.id
  )
    throw Error("WORK_SOURCE_UNAVAILABLE");
  const versions = row.versions.filter((v) => v.entity.type === type && v.entity.id === task.id);
  if (versions.length !== 1) throw Error("WORK_SOURCE_UNAVAILABLE");
  return { row, version: positive.parse(versions[0]!.version), selector };
}
export async function readOverviewWorkSource(
  scope: ClientScope,
  task: ManagementWorkView,
  context?: AccountReadContext,
) {
  checkTask(task);
  const base = `/o/${scope.orgId}/c/${scope.centerId}`;
  if (task.target.operation === "session_get_v1") {
    const session = await (
      await scopedBackend(scope, undefined, context)
    ).call("session_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      session_id: task.id,
    });
    if (
      session.id !== task.id ||
      session.version !== task.version ||
      session.attendance_state === "closed" ||
      session.state === "cancelled"
    )
      throw Error("WORK_SOURCE_CHANGED");
    return {
      kind: "flow" as const,
      href: `${base}/sessions/${task.id}?tab=attendance`,
      scope: { ...scope },
      task,
    };
  }
  if (task.target.operation === "event_get_v1") {
    const event = await readEvent(scope, task.id, undefined, context);
    if (
      event.version !== task.version ||
      event.attendance_state === "closed" ||
      !["published", "occurred"].includes(event.state)
    )
      throw Error("WORK_SOURCE_CHANGED");
    return { kind: "flow" as const, href: `${base}/events/${task.id}`, scope: { ...scope }, task };
  }
  const source = await readManagement(scope, task, context);
  if (source.version !== task.version) throw Error("WORK_SOURCE_CHANGED");
  if (task.kind === "lesson_request") {
    const detail = requestDetail(source.row, scope, source.selector.operation, task.id);
    if (!["pending", "alternative_offered"].includes(detail.state))
      throw Error("WORK_SOURCE_CHANGED");
    return {
      kind: "flow" as const,
      href: `${base}/requests?request=${task.id}`,
      scope: { ...scope },
      task,
    };
  }
  if (task.kind === "application_review") {
    if (source.row.state !== "pending") throw Error("WORK_SOURCE_CHANGED");
    return { kind: "application" as const, scope: { ...scope }, task };
  }
  if (
    source.row.current?.operation !== "crm_activity_save_v1" ||
    source.selector.operation !== "crm_activity_save_v1" ||
    source.row.current.values.activity_id !== task.id ||
    source.row.current.values.kind !== "followup" ||
    source.row.state === "completed"
  )
    throw Error("WORK_SOURCE_CHANGED");
  const values = source.row.current.values;
  if (
    (values.lead_id ?? null) !== (source.selector.key.lead_id ?? null) ||
    (source.selector.key.person_id && values.person_id !== source.selector.key.person_id)
  )
    throw Error("WORK_SOURCE_UNAVAILABLE");
  return { kind: "followup" as const, scope: { ...scope }, task, values, version: source.version };
}
export type OverviewWorkSource = Awaited<ReturnType<typeof readOverviewWorkSource>>;
export async function overviewFollowupIntent(
  before: Extract<OverviewWorkSource, { kind: "followup" }>,
  outcome: string,
) {
  const text = z.string().trim().min(1).parse(outcome);
  const current = await readOverviewWorkSource(before.scope, before.task);
  if (current.kind !== "followup" || current.version !== before.version)
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  return { before: structuredClone(before), outcome: text, key: uuidv7() };
}
type FollowupIntent = Awaited<ReturnType<typeof overviewFollowupIntent>>;
export async function writeOverviewFollowup(intent: FollowupIntent) {
  const { before } = intent,
    selector = before.task.target;
  if (
    selector.operation !== "management_state_get_v1" ||
    selector.selector.operation !== "crm_activity_save_v1"
  )
    throw Error("WORK_SOURCE_UNAVAILABLE");
  const key = selector.selector.key;
  return (await scopedBackend(before.scope)).call("crm_activity_save_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: before.scope.orgId,
    center_id: before.scope.centerId,
    operation_key: intent.key,
    activity_id: before.task.id,
    expected_version: before.version,
    ...(key.lead_id
      ? { lead_id: key.lead_id }
      : { person_id: z.uuid().parse(key.person_id), lead_id: null }),
    kind: "outcome",
    outcome: intent.outcome,
    note: before.values.note ?? null,
    due_at: before.values.due_at ?? null,
  });
}
export async function readOverviewFollowupReceipt(intent: FollowupIntent) {
  const receipt = await (
    await scopedBackend(intent.before.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.before.scope.orgId,
    operation: "crm_activity_save_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "crm_activity_save_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== "crm_activities" ||
        receipt.result_reference.id !== intent.before.task.id))
  )
    throw Error("WORK_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readOverviewFollowupResult(intent: FollowupIntent, id?: string) {
  if (id !== intent.before.task.id) throw Error("WORK_RESULT_UNAVAILABLE");
  const source = await readManagement(intent.before.scope, intent.before.task),
    row = source.row;
  if (
    source.version <= intent.before.version ||
    row.state !== "completed" ||
    row.current?.operation !== "crm_activity_save_v1" ||
    row.current.values.activity_id !== id ||
    row.current.values.kind !== "outcome" ||
    row.current.values.outcome !== intent.outcome
  )
    throw Error("WORK_RESULT_UNAVAILABLE");
  return source;
}
