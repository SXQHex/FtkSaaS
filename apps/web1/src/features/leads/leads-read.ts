import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
const base = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export async function readLeadsPage(scope: ClientScope, query: string, cursor?: string) {
  const backend = await scopedBackend(scope),
    page = await backend.call("leads_list_v1", {
      ...base(scope),
      request_id: uuidv7(),
      include_pipeline: true,
      ...(query.trim() ? { query: query.trim() } : {}),
      page: { limit: 20, sort: "created_at_desc", ...(cursor ? { cursor } : {}) },
    });
  const ids = new Set<string>();
  for (const row of page.items) {
    z.uuid().parse(row.id);
    z.uuid().parse(row.person_id);
    z.number().int().positive().parse(row.version);
    if (ids.has(row.id)) throw new Error("LEAD_PAGE_REPEATED");
    ids.add(row.id);
  }
  const personIds = [
    ...new Set(
      page.items.flatMap((row) => [row.person_id, ...(row.assigned_to ? [row.assigned_to] : [])]),
    ),
  ];
  const people = await Promise.all(
    personIds.map(async (personId) => {
      try {
        const person = await backend.call("person_get_v1", {
          ...base(scope),
          request_id: uuidv7(),
          person_id: personId,
        });
        if (person.id !== personId) throw new Error("LEAD_PERSON_MISMATCH");
        return person;
      } catch (error) {
        if (error instanceof BackendError && error.code === "FORBIDDEN") return undefined;
        throw error;
      }
    }),
  );
  return { ...page, people: people.filter((person) => person !== undefined) };
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
