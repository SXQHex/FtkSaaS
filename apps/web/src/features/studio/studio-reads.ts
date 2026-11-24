import type { AccountReadContext } from "../../lib/scoped-backend";
import { v7 as uuidv7 } from "uuid";
import { studioBackend, studioPages, type StudioScope } from "./studio";
import type {
  AvailabilityRule,
  Interval,
  ManagementSelector,
  ManagementStateView,
  PersonView,
  ResourceRef,
} from "@ftksaas/api-contracts";

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
  state: "active" | "cancelled";
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
  readContext?: AccountReadContext,
) {
  const backend = client ?? (await studioBackend(scope, undefined, readContext));
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
  readContext?: AccountReadContext,
  signal = readContext?.signal,
): Promise<InstructorRecord[]> {
  const backend = await studioBackend(scope, signal, readContext);
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

function batches<T>(values: T[]) {
  return Array.from({ length: Math.ceil(values.length / 50) }, (_, index) =>
    values.slice(index * 50, index * 50 + 50),
  );
}

function resourceKey({ kind, id }: ResourceRef) {
  return kind + "/" + id;
}

function resourceSelector([resource, ...rest]: ResourceRef[]) {
  if (!resource) throw new Error("STUDIO_UNAVAILABLE");
  return rest.length
    ? { resources: [resource, ...rest] as [ResourceRef, ...ResourceRef[]] }
    : { resource };
}

export async function readStudioPrograms(
  scope: StudioScope,
  classId: string | string[],
  readContext?: AccountReadContext,
) {
  const groups = batches(typeof classId === "string" ? [classId] : classId);
  const pages = await Promise.all(
    groups.map(async ([first, ...rest]) => {
      const requested = new Set([first!, ...rest]);
      const items = await management(
        scope,
        {
          operation: "program_preview_v1",
          key: rest.length ? { class_ids: [first!, ...rest] } : { class_id: first! },
        },
        undefined,
        readContext,
      );
      if (
        items.some(
          ({ current }) =>
            current?.operation !== "program_preview_v1" ||
            !current.values.class_id ||
            !requested.has(current.values.class_id),
        )
      )
        throw new Error("STUDIO_UNAVAILABLE");
      return items;
    }),
  );
  return pages.flat();
}

export async function readStudioAvailability(
  scope: StudioScope,
  resource: ResourceRef,
  client?: Awaited<ReturnType<typeof studioBackend>>,
  readContext?: AccountReadContext,
): Promise<AvailabilityRecord[]> {
  return (await readStudioAvailabilityByResource(scope, [resource], client, readContext)).get(
    resourceKey(resource),
  )!;
}

export async function readStudioAvailabilityByResource(
  scope: StudioScope,
  resources: ResourceRef[],
  client?: Awaited<ReturnType<typeof studioBackend>>,
  readContext?: AccountReadContext,
) {
  const grouped = new Map(
    resources.map((resource) => [resourceKey(resource), [] as AvailabilityRecord[]]),
  );
  await Promise.all(
    batches(resources).map(async (group) => {
      const requested = new Set(group.map(resourceKey));
      const items = await management(
        scope,
        { operation: "availability_save_v1", key: resourceSelector(group) },
        client,
        readContext,
      );
      for (const item of items) {
        if (item.state !== "active" && item.state !== "inactive")
          throw new Error("STUDIO_UNAVAILABLE");
        if (item.state !== "active") continue;
        if (
          item.current?.operation !== "availability_save_v1" ||
          !item.current.values.resource ||
          !requested.has(resourceKey(item.current.values.resource)) ||
          !item.current.values.rule ||
          item.current.values.rule_id !== item.entity?.id
        )
          throw new Error("STUDIO_UNAVAILABLE");
        grouped.get(resourceKey(item.current.values.resource))!.push({
          id: item.entity!.id,
          version: versionOf(item, "availability_rules"),
          rule: item.current.values.rule,
        });
      }
    }),
  );
  return grouped;
}

export async function readStudioClosures(
  scope: StudioScope,
  resource: ResourceRef | ResourceRef[],
  readContext?: AccountReadContext,
): Promise<ClosureRecord[]> {
  const resources = Array.isArray(resource) ? resource : [resource];
  const grouped = new Map(resources.map((value) => [resourceKey(value), [] as ClosureRecord[]]));
  await Promise.all(
    batches(resources).map(async (group) => {
      const requested = new Set(group.map(resourceKey));
      const items = await management(
        scope,
        { operation: "availability_exception_save_v1", key: resourceSelector(group) },
        undefined,
        readContext,
      );
      for (const item of items) {
        if (
          (item.state !== "active" && item.state !== "cancelled") ||
          !item.exists ||
          item.entity?.type !== "availability_exceptions" ||
          item.current?.operation !== "availability_exception_save_v1" ||
          !item.current.values.resource ||
          !requested.has(resourceKey(item.current.values.resource)) ||
          !item.current.values.interval
        )
          throw new Error("STUDIO_UNAVAILABLE");
        grouped.get(resourceKey(item.current.values.resource))!.push({
          id: item.entity.id,
          resource: item.current.values.resource,
          interval: item.current.values.interval,
          state: item.state,
        });
      }
    }),
  );
  return [...grouped.values()].flat();
}

export async function readStudioAgreements(
  scope: StudioScope,
  personId: string | string[],
  readContext?: AccountReadContext,
  signal = readContext?.signal,
) {
  const groups = batches(typeof personId === "string" ? [personId] : personId);
  if (!groups.length) return [];
  const backend = await studioBackend(scope, signal, readContext);
  const pages = await Promise.all(
    groups.map(async ([first, ...rest]) => {
      const requested = new Set([first, ...rest]);
      const items = await studioPages((cursor) =>
        backend.call("instructor_agreements_list_v1", {
          client_api_version: 1,
          request_id: uuidv7(),
          org_id: scope.orgId,
          center_id: scope.centerId,
          ...(rest.length ? { person_ids: [first!, ...rest] } : { person_id: first! }),
          page: { limit: 50, ...(cursor ? { cursor } : {}) },
        }),
      );
      if (items.some((item) => !requested.has(item.person_id) || item.center_id !== scope.centerId))
        throw new Error("STUDIO_UNAVAILABLE");
      return items;
    }),
  );
  return pages.flat();
}
