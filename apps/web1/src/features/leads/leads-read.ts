import { BackendError } from "../../lib/backend";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
const base = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export interface LeadFilters {
  stage?: string;
  assignedTo?: string | null;
}
export async function readLeadsPage(
  scope: ClientScope,
  query: string,
  cursor?: string,
  filters: LeadFilters = {},
) {
  const page = await (
    await scopedBackend(scope)
  ).call("leads_list_v1", {
    ...base(scope),
    request_id: uuidv7(),
    include_pipeline: true,
    include_details: true,
    include_summary: true,
    ...(query.trim() ? { query: query.trim() } : {}),
    ...(filters.stage ? { stage_key: filters.stage } : {}),
    ...(filters.assignedTo !== undefined ? { assigned_to: filters.assignedTo } : {}),
    page: { limit: 20, sort: "created_at_desc", ...(cursor ? { cursor } : {}) },
  });
  const ids = new Set<string>();
  for (const row of page.items) {
    z.uuid().parse(row.id);
    z.uuid().parse(row.person_id);
    z.number().int().positive().parse(row.version);
    z.string().min(1).parse(row.display_name);
    z.iso.datetime({ offset: true }).parse(row.created_at);
    if (ids.has(row.id)) throw new Error("LEAD_PAGE_REPEATED");
    ids.add(row.id);
  }
  if (!page.summary) throw new Error("LEAD_SUMMARY_UNAVAILABLE");
  for (const value of Object.values(page.summary))
    z.number().int().nonnegative().safe().parse(value);
  if (page.summary.total < page.items.length || (cursor && cursor === page.next_cursor))
    throw new Error("LEAD_PAGE_UNAVAILABLE");
  return page;
}
export async function readLeadAssignees(scope: ClientScope, cursor?: string) {
  const page = await (
    await scopedBackend(scope)
  ).call("management_state_get_v1", {
    ...base(scope),
    request_id: uuidv7(),
    operation: "lead_save_v1",
    selector: { operation: "lead_save_v1", key: { directory: "assignees" } },
    page: { limit: 200, ...(cursor ? { cursor } : {}) },
  });
  const seen = new Set<string>();
  const items = page.items.map((row) => {
    const value = row.crm_discovery;
    if (row.operation !== "lead_save_v1" || !row.exists || value?.kind !== "assignee")
      throw new Error("LEAD_ASSIGNEE_UNAVAILABLE");
    z.uuid().parse(value.person_id);
    if (seen.has(value.person_id)) throw new Error("LEAD_ASSIGNEE_REPEATED");
    seen.add(value.person_id);
    return { id: value.person_id, name: value.display_name };
  });
  if (cursor && cursor === page.next_cursor) throw new Error("LEAD_CURSOR_REPEATED");
  return { ...page, items };
}
export async function readLeadFollowups(
  scope: ClientScope,
  cursor?: string,
  assignedTo?: string | null,
) {
  const page = await (
    await scopedBackend(scope)
  ).call("management_state_get_v1", {
    ...base(scope),
    request_id: uuidv7(),
    operation: "crm_activity_save_v1",
    selector: {
      operation: "crm_activity_save_v1",
      key: {
        directory: "followups",
        state: "all",
        ...(assignedTo !== undefined ? { assigned_to: assignedTo } : {}),
      },
    },
    page: { limit: 20, sort: "due_at_asc", ...(cursor ? { cursor } : {}) },
  });
  const seen = new Set<string>();
  const items = page.items.map((row) => {
    const value = row.crm_discovery;
    if (
      row.operation !== "crm_activity_save_v1" ||
      !row.exists ||
      value?.kind !== "followup" ||
      row.entity?.type !== "crm_activities" ||
      row.entity.id !== value.activity_id
    )
      throw new Error("LEAD_FOLLOWUP_UNAVAILABLE");
    const versions = row.versions.filter(
      (v) => v.entity.type === "crm_activities" && v.entity.id === value.activity_id,
    );
    if (versions.length !== 1 || seen.has(value.activity_id))
      throw new Error("LEAD_FOLLOWUP_UNAVAILABLE");
    z.number().int().positive().safe().parse(versions[0]!.version);
    seen.add(value.activity_id);
    return value;
  });
  if (cursor && cursor === page.next_cursor) throw new Error("LEAD_CURSOR_REPEATED");
  return { ...page, items };
}
export async function readLeadDetail(scope: ClientScope, personId: string, leadId?: string) {
  const backend = await scopedBackend(scope),
    page = await backend.call("management_state_get_v1", {
      ...base(scope),
      request_id: uuidv7(),
      operation: "lead_save_v1",
      selector: {
        operation: "lead_save_v1",
        key: { person_id: personId, ...(leadId ? { lead_id: leadId } : {}) },
      },
      page: { limit: 20 },
    });
  const candidates = page.items.filter(
    (item) =>
      item.exists && item.entity?.type === "leads" && (!leadId || item.entity.id === leadId),
  );
  if (candidates.length !== 1) throw new Error("LEAD_DETAIL_UNAVAILABLE");
  const item = candidates[0],
    projection = item.current;
  if (
    !item.entity ||
    projection?.operation !== "lead_save_v1" ||
    projection.values.person_id !== personId ||
    typeof projection.values.source !== "string" ||
    typeof projection.values.interest !== "string" ||
    projection.values.assigned_to === undefined ||
    projection.values.pipeline === undefined
  )
    throw new Error("LEAD_DETAIL_UNAVAILABLE");
  const versions = item.versions.filter(
    (version) => version.entity.type === "leads" && version.entity.id === item.entity?.id,
  );
  if (versions.length !== 1) throw new Error("LEAD_VERSION_UNAVAILABLE");
  return {
    id: item.entity.id,
    personId,
    state: z.enum(["open", "converted", "closed"]).parse(item.state),
    version: z.number().int().positive().parse(versions[0].version),
    values: projection.values,
  };
}
export type LeadDetail = Awaited<ReturnType<typeof readLeadDetail>>;
export async function readLeadActivities(
  scope: ClientScope,
  leadId: string,
  cursor?: string,
  activityId?: string,
) {
  const backend = await scopedBackend(scope),
    page = await backend.call("management_state_get_v1", {
      ...base(scope),
      request_id: uuidv7(),
      operation: "crm_activity_save_v1",
      selector: {
        operation: "crm_activity_save_v1",
        key: { lead_id: leadId, ...(activityId ? { activity_id: activityId } : {}) },
      },
      page: { limit: 20, ...(cursor ? { cursor } : {}) },
    });
  const items = page.items.map((item) => {
    if (
      !item.entity ||
      item.entity.type !== "crm_activities" ||
      item.current?.operation !== "crm_activity_save_v1" ||
      item.current.values.lead_id !== leadId ||
      item.current.values.kind === undefined ||
      item.current.values.note === undefined ||
      item.current.values.outcome === undefined ||
      item.current.values.due_at === undefined
    )
      throw new Error("LEAD_ACTIVITY_UNAVAILABLE");
    const versions = item.versions.filter(
      (version) =>
        version.entity.type === "crm_activities" && version.entity.id === item.entity?.id,
    );
    if (versions.length !== 1) throw new Error("LEAD_ACTIVITY_VERSION_UNAVAILABLE");
    return {
      id: item.entity.id,
      version: z.number().int().positive().parse(versions[0].version),
      state: item.state,
      values: item.current.values,
    };
  });
  return { ...page, items };
}
export async function readApplicationsPage(
  scope: ClientScope,
  cursor?: string,
  applicationId?: string,
) {
  const backend = await scopedBackend(scope),
    page = await backend.call("management_state_get_v1", {
      ...base(scope),
      request_id: uuidv7(),
      operation: "public_application_review_v1",
      selector: {
        operation: "public_application_review_v1",
        key: {
          ...(applicationId ? { application_id: applicationId } : {}),
          include_contact_intake: true,
        },
      },
      page: { limit: 20, ...(cursor ? { cursor } : {}) },
    });
  const items = page.items.map((item) => {
    if (
      !item.entity ||
      item.entity.type !== "public_applications" ||
      item.current?.operation !== "public_application_review_v1" ||
      (applicationId && item.entity.id !== applicationId)
    )
      throw new Error("APPLICATION_SOURCE_UNAVAILABLE");
    const versions = item.versions.filter(
      (version) =>
        version.entity.type === "public_applications" && version.entity.id === item.entity?.id,
    );
    if (versions.length !== 1) throw new Error("APPLICATION_VERSION_UNAVAILABLE");
    return {
      id: item.entity.id,
      version: z.number().int().positive().parse(versions[0].version),
      state: z.enum(["pending", "reviewed", "closed"]).parse(item.state),
      asOf: item.as_of,
      values: item.current.values,
    };
  });
  return { ...page, items };
}

export async function readStudentFollowups(
  scope: ClientScope,
  kind: "renewal_due" | "inactive_student",
  cursor?: string,
) {
  const backend = await scopedBackend(scope),
    page = await backend.call("crm_followup_list_v1", {
      ...base(scope),
      request_id: uuidv7(),
      kind,
      page: { limit: 20, sort: "due_at_asc", ...(cursor ? { cursor } : {}) },
    });
  const ids = new Set<string>();
  for (const row of page.items) {
    if (row.kind !== kind || row.center_id !== scope.centerId || ids.has(row.id))
      throw Error("STUDENT_FOLLOWUP_UNAVAILABLE");
    ids.add(row.id);
    z.uuid().parse(row.person_id);
    z.iso.datetime({ offset: true }).parse(row.due_at);
  }
  if (cursor && cursor === page.next_cursor) throw Error("LEAD_CURSOR_REPEATED");
  const personIds = [
    ...new Set(
      page.items.flatMap((row) => [row.person_id, ...(row.assigned_to ? [row.assigned_to] : [])]),
    ),
  ];
  const names = new Map(
    await Promise.all(
      personIds.map(async (personId) => {
        try {
          const person = await backend.call("person_get_v1", {
            ...base(scope),
            request_id: uuidv7(),
            person_id: personId,
          });
          if (person.id !== personId) throw Error("LEAD_PERSON_MISMATCH");
          return [personId, person.display_name] as const;
        } catch (cause) {
          if (cause instanceof BackendError && cause.code === "FORBIDDEN")
            return [personId, undefined] as const;
          throw cause;
        }
      }),
    ),
  );
  return {
    ...page,
    items: page.items.map((row) => ({
      ...row,
      name: names.get(row.person_id),
      assignedName: row.assigned_to ? names.get(row.assigned_to) : null,
    })),
  };
}
