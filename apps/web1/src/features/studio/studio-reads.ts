import { v7 as uuidv7 } from "uuid";
import { studioBackend, studioPages, type StudioScope } from "./studio";
import type {
  AvailabilityRule,
  Interval,
  ManagementSelector,
  ManagementStateView,
  PersonView,
  ResourceRef,
} from "../../lib/api-contracts/generated";

export interface InstructorRecord {
  assignmentId: string;
  version: number;
  active: boolean;
  accountAccessGranted: boolean | null;
  person: PersonView;
}
export interface AvailabilityRecord {
  id: string;
  version: number;
  rule: AvailabilityRule;
}
export interface ClosureRecord {
  id: string;
  resource: ResourceRef;
  interval: Interval;
  // The API intentionally does not expose the saved reason. Do not substitute
  // a fabricated reason or treat an omitted value as an empty saved reason.
}

function versionOf(item: ManagementStateView, entityType: string) {
  if (!item.exists || item.entity?.type !== entityType) throw new Error("STUDIO_UNAVAILABLE");
  const versions = item.versions.filter(
    (value) => value.entity.type === entityType && value.entity.id === item.entity?.id,
  );
  const version = versions[0]?.version;
  if (versions.length !== 1 || !version || !Number.isSafeInteger(version) || version < 1)
    throw new Error("STUDIO_UNAVAILABLE");
  return version;
}

async function management(
  scope: StudioScope,
  selector: ManagementSelector,
  client?: Awaited<ReturnType<typeof studioBackend>>,
) {
  const backend = client ?? (await studioBackend(scope));
  return studioPages((cursor) =>
    backend.call("management_state_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: selector.operation,
      selector,
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    }),
  );
}

export async function readStudioInstructors(
  scope: StudioScope,
  personId?: string,
): Promise<InstructorRecord[]> {
  const backend = await studioBackend(scope);
  const assignments = await studioPages((cursor) =>
    backend.call("management_state_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: "role_assign_v1",
      selector: {
        operation: "role_assign_v1",
        key: {
          role: "instructor",
          scope: { center_id: scope.centerId },
          ...(personId ? { person_id: personId } : {}),
        },
      },
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    }),
  );
  const records = assignments.map((item) => {
    const version = versionOf(item, "role_assignments");
    if (
      item.current?.operation !== "role_assign_v1" ||
      item.current.values.role !== "instructor" ||
      item.current.values.scope?.center_id !== scope.centerId ||
      !item.current.values.person_id ||
      (personId !== undefined && item.current.values.person_id !== personId) ||
      (item.state !== "active" && item.state !== "inactive")
    )
      throw new Error("STUDIO_UNAVAILABLE");
    return {
      assignmentId: item.entity!.id,
      version,
      active: item.state === "active",
      accountAccessGranted: item.account_access_granted ?? null,
      personId: item.current.values.person_id,
    };
  });
  // Read each person once even when the role history contains several records.
  const people = new Map(
    await Promise.all(
      [...new Set(records.map((item) => item.personId))].map(async (personId) => {
        const person = await backend.call("person_get_v1", {
          client_api_version: 1,
          request_id: uuidv7(),
          org_id: scope.orgId,
          center_id: scope.centerId,
          person_id: personId,
        });
        if (person.id !== personId) throw new Error("STUDIO_UNAVAILABLE");
        return [personId, person] as const;
      }),
    ),
  );
  return records.map(({ personId, ...record }) => ({ ...record, person: people.get(personId)! }));
}

export function readStudioPrograms(scope: StudioScope, classId: string) {
  return management(scope, { operation: "program_preview_v1", key: { class_id: classId } }).then(
    (items) => {
      return items.map((item) => {
        if (
          item.current?.operation !== "program_preview_v1" ||
          item.current.values.class_id !== classId
        )
          throw new Error("STUDIO_UNAVAILABLE");
        return item;
      });
    },
  );
}

export async function readStudioAvailability(
  scope: StudioScope,
  resource: ResourceRef,
  client?: Awaited<ReturnType<typeof studioBackend>>,
): Promise<AvailabilityRecord[]> {
  const items = await management(
    scope,
    { operation: "availability_save_v1", key: { resource } },
    client,
  );
  return items.map((item) => {
    // Rules have their own version. An exception's center version cannot be used here.
    const version = versionOf(item, "availability_rules");
    if (
      item.current?.operation !== "availability_save_v1" ||
      item.current.values.resource?.kind !== resource.kind ||
      item.current.values.resource.id !== resource.id ||
      !item.current.values.rule ||
      item.current.values.rule_id !== item.entity?.id
    )
      throw new Error("STUDIO_UNAVAILABLE");
    return { id: item.entity!.id, version, rule: item.current.values.rule };
  });
}

export async function readStudioClosures(
  scope: StudioScope,
  resource: ResourceRef,
): Promise<ClosureRecord[]> {
  const items = await management(scope, {
    operation: "availability_exception_save_v1",
    key: { resource },
  });
  return items.map((item) => {
    if (
      !item.exists ||
      item.entity?.type !== "availability_exceptions" ||
      item.current?.operation !== "availability_exception_save_v1" ||
      item.current.values.resource?.kind !== resource.kind ||
      item.current.values.resource.id !== resource.id ||
      !item.current.values.interval
    )
      throw new Error("STUDIO_UNAVAILABLE");
    return {
      id: item.entity.id,
      resource: item.current.values.resource,
      interval: item.current.values.interval,
    };
  });
}

export async function readStudioAgreements(scope: StudioScope, personId: string) {
  const backend = await studioBackend(scope);
  const items = await studioPages((cursor) =>
    backend.call("instructor_agreements_list_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    }),
  );
  if (items.some((item) => item.person_id !== personId || item.center_id !== scope.centerId))
    throw new Error("STUDIO_UNAVAILABLE");
  return items;
}
