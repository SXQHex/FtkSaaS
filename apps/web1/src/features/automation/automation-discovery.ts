import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { AutomationJobView, JobState, Interval } from "../../lib/api-contracts/generated";
import { getTemporal } from "../../lib/temporal";
const count = z.number().int().nonnegative().safe(),
  version = z.number().int().positive().safe(),
  instant = z.iso.datetime({ offset: true });
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
  request_id: uuidv7(),
});
const configScope = (scope: ClientScope) => ({
  kind: "center" as const,
  center_id: scope.centerId,
});
const summarySchema = z.object({
  audience_count: count,
  matched_count: count,
  using_automations: count,
});
export async function readSegmentDiscovery(
  scope: ClientScope,
  segmentId: string,
  mode: "matches" | "automations",
  cursor?: string,
) {
  z.uuid().parse(segmentId);
  const page = await (
    await scopedBackend(scope)
  ).call("management_state_get_v1", {
    ...common(scope),
    operation: "segment_save_v1",
    selector: {
      operation: "segment_save_v1",
      key: {
        scope: configScope(scope),
        segment_id: segmentId,
        ...(mode === "matches"
          ? { discovery: mode, execution_center_id: scope.centerId }
          : { discovery: mode }),
      },
    },
    page: { limit: 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  instant.parse(page.as_of);
  if (page.items.length > 20 || (cursor && page.next_cursor === cursor))
    throw Error("AUTOMATION_DISCOVERY_UNAVAILABLE");
  const ids = new Set<string>();
  const items = page.items.map((row) => {
    const match = row.segment_match,
      reference = row.automation_reference;
    const id = mode === "matches" ? match?.person_id : reference?.id;
    if (
      !id ||
      ids.has(id) ||
      !row.exists ||
      row.entity?.id !== id ||
      row.entity.type !== (mode === "matches" ? "people" : "automations") ||
      row.operation !== (mode === "matches" ? "segment_save_v1" : "automation_save_v1")
    )
      throw Error("AUTOMATION_DISCOVERY_UNAVAILABLE");
    ids.add(z.uuid().parse(id));
    if (
      mode === "automations" &&
      (!reference ||
        row.versions.filter(
          (v) =>
            v.entity.type === "automations" &&
            v.entity.id === id &&
            v.version === reference.version,
        ).length !== 1)
    )
      throw Error("AUTOMATION_DISCOVERY_UNAVAILABLE");
    if (reference) version.parse(reference.version);
    return {
      id,
      name: z
        .string()
        .min(1)
        .parse(mode === "matches" ? match!.display_name : reference!.name),
      enabled: mode === "automations" ? z.boolean().parse(reference!.enabled) : undefined,
    };
  });
  const summary = mode === "matches" ? summarySchema.parse(page.segment_summary) : undefined;
  if (summary && summary.matched_count > summary.audience_count)
    throw Error("AUTOMATION_DISCOVERY_UNAVAILABLE");
  return { items, summary, nextCursor: page.next_cursor, asOf: page.as_of };
}
const jobSchema = z.object({
  id: z.uuid(),
  version,
  center_id: z.uuid(),
  person_id: z.uuid(),
  state: z.enum(["pending", "running", "retry_wait", "succeeded", "failed", "cancelled"]),
  attempts: count,
  next_attempt_at: instant.nullable(),
  safe_error_code: z.string().nullable(),
  result_reference: z
    .object({ type: z.enum(["notifications", "crm_activities"]), id: z.uuid() })
    .nullable(),
  retry_available: z.boolean(),
  created_at: instant,
  automation_id: z.uuid(),
  automation_version: version,
  automation_name: z.string().min(1),
  configuration_creator_person_id: z.uuid(),
  initiator_kind: z.literal("automation"),
});
const queueSchema = z.object({
  total: count,
  pending: count,
  running: count,
  retry_wait: count,
  succeeded: count,
  failed: count,
  cancelled: count,
  notifications_created: count,
  followups_created: count,
  email_delivery: z.literal("not_supported"),
});
export async function readAutomationQueue(
  scope: ClientScope,
  filter: { automationId?: string; state: JobState | "all"; interval?: Interval },
  cursor?: string,
) {
  const page = await (
    await scopedBackend(scope)
  ).call("management_state_get_v1", {
    ...common(scope),
    operation: "automation_save_v1",
    selector: {
      operation: "automation_save_v1",
      key: {
        scope: configScope(scope),
        discovery: "jobs",
        state: filter.state,
        ...(filter.interval ? { interval: filter.interval } : {}),
        ...(filter.automationId ? { automation_id: z.uuid().parse(filter.automationId) } : {}),
      },
    },
    page: { limit: 20, sort: "created_at_desc", ...(cursor ? { cursor } : {}) },
  });
  instant.parse(page.as_of);
  if (page.items.length > 20 || (cursor && page.next_cursor === cursor))
    throw Error("AUTOMATION_QUEUE_UNAVAILABLE");
  const ids = new Set<string>();
  const items = page.items.map((row) => {
    const job = jobSchema.parse(row.automation_job);
    if (
      !row.exists ||
      row.operation !== "automation_save_v1" ||
      row.entity?.type !== "outbox_jobs" ||
      row.entity.id !== job.id ||
      row.state !== job.state ||
      ids.has(job.id) ||
      (filter.automationId && job.automation_id !== filter.automationId) ||
      (filter.state !== "all" && job.state !== filter.state) ||
      row.versions.filter(
        (v) =>
          v.entity.type === "outbox_jobs" && v.entity.id === job.id && v.version === job.version,
      ).length !== 1
    )
      throw Error("AUTOMATION_QUEUE_UNAVAILABLE");
    ids.add(job.id);
    return job satisfies AutomationJobView;
  });
  const summary = queueSchema.parse(page.automation_queue_summary);
  if (
    summary.pending +
      summary.running +
      summary.retry_wait +
      summary.succeeded +
      summary.failed +
      summary.cancelled !==
      summary.total ||
    summary.notifications_created > summary.total ||
    summary.followups_created > summary.total
  )
    throw Error("AUTOMATION_QUEUE_UNAVAILABLE");
  return { items, summary, nextCursor: page.next_cursor, asOf: page.as_of };
}

// A known native timestamp narrows this lookup to one database timestamp, never job history.
export async function readKnownAutomationJob(scope: ClientScope, before: AutomationJobView) {
  if (!before.created_at || !before.automation_id) throw Error("AUTOMATION_JOB_UNAVAILABLE");
  const temporal = await getTemporal();
  const interval = {
    starts_at: before.created_at,
    ends_at: temporal.Instant.from(before.created_at).add({ microseconds: 1 }).toString(),
  };
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await readAutomationQueue(
      scope,
      { automationId: before.automation_id, state: "all", interval },
      cursor,
    );
    const actual = page.items.find((row) => row.id === before.id);
    if (actual) {
      if (temporal.Instant.compare(actual.created_at, before.created_at) !== 0)
        throw Error("AUTOMATION_JOB_UNAVAILABLE");
      return actual;
    }
    cursor = page.nextCursor ?? undefined;
    if (cursor) {
      if (seen.has(cursor)) throw Error("AUTOMATION_CURSOR_UNAVAILABLE");
      seen.add(cursor);
    }
  } while (cursor);
  throw Error("AUTOMATION_JOB_UNAVAILABLE");
}
