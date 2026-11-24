import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { queryBackendRead } from "../../lib/backend";
import {
  scopedBackend as studioBackend,
  type ClientScope,
  type AccountReadContext,
} from "../../lib/scoped-backend";
import type {
  ClassWaitlistImpact,
  DisciplineView,
  ManagementSelector,
  ManagementStateView,
  RoomDeactivationEffects,
} from "@ftksaas/api-contracts";

export { studioBackend };
export type StudioScope = ClientScope;
export type ResourceKind = "room" | "class";
export interface ResourceDraft {
  name: string;
  capacity: string;
  disciplineId: string;
  active: boolean;
  externalOpen: boolean;
  waitlist: boolean;
}
interface ResourceBase {
  id: string;
  version: number;
  scope: StudioScope;
}
export interface RoomRecord extends ResourceBase {
  kind: "room";
  name: string;
  capacity: number | null;
  active: boolean;
  effects?: RoomDeactivationEffects;
}
export interface ClassRecord extends ResourceBase {
  kind: "class";
  name: string;
  disciplineId: string;
  active: boolean;
  externalOpen: boolean;
  waitlist: boolean;
  effects?: ClassWaitlistImpact;
}
export type ResourceRecord = RoomRecord | ClassRecord;
export interface ResourceIntent {
  scope: StudioScope;
  kind: ResourceKind;
  key: string;
  base?: ResourceRecord;
  draft: ResourceDraft;
}

export function resourceSchema(
  kind: ResourceKind,
  messages = {
    name: "NAME_REQUIRED",
    capacity: "CAPACITY_INVALID",
    discipline: "DISCIPLINE_REQUIRED",
  },
) {
  return z
    .object({
      name: z.string(),
      capacity: z.string(),
      disciplineId: z.string(),
      active: z.boolean(),
      externalOpen: z.boolean(),
      waitlist: z.boolean(),
    })
    .superRefine((value, context) => {
      if (!value.name.trim())
        context.addIssue({ code: "custom", path: ["name"], message: messages.name });
      if (
        kind === "room" &&
        (!/^\d+$/.test(value.capacity) || !Number.isSafeInteger(Number(value.capacity)))
      )
        context.addIssue({ code: "custom", path: ["capacity"], message: messages.capacity });
      if (kind === "class" && !value.disciplineId)
        context.addIssue({ code: "custom", path: ["disciplineId"], message: messages.discipline });
    });
}

export async function studioPages<T>(
  read: (cursor?: string) => Promise<{ items: T[]; next_cursor: string | null }>,
) {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await read(cursor);
    items.push(...page.items);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  return items;
}

function entityVersion(item: ManagementStateView, type: "rooms" | "classes") {
  if (!item.exists || item.entity?.type !== type) throw new Error("STUDIO_UNAVAILABLE");
  const versions = item.versions.filter(
    (entry) => entry.entity.type === type && entry.entity.id === item.entity?.id,
  );
  const version = versions[0]?.version;
  if (versions.length !== 1 || !version || !Number.isSafeInteger(version) || version < 1)
    throw new Error("STUDIO_UNAVAILABLE");
  return { id: item.entity.id, version };
}

function roomRecord(scope: StudioScope, item: ManagementStateView): RoomRecord {
  const identity = entityVersion(item, "rooms");
  if (item.current?.operation !== "room_save_v1") throw new Error("STUDIO_UNAVAILABLE");
  const value = item.current.values;
  if (
    value.room_id !== identity.id ||
    typeof value.name !== "string" ||
    (value.capacity !== null &&
      (typeof value.capacity !== "number" ||
        !Number.isSafeInteger(value.capacity) ||
        value.capacity < 0)) ||
    (item.state !== "active" && item.state !== "inactive")
  )
    throw new Error("STUDIO_UNAVAILABLE");
  return {
    ...identity,
    scope,
    kind: "room",
    name: value.name,
    capacity: value.capacity,
    active: item.state === "active",
    effects: value.deactivation_effects,
  };
}

function classRecord(scope: StudioScope, item: ManagementStateView): ClassRecord {
  const identity = entityVersion(item, "classes");
  if (item.current?.operation !== "class_save_v1") throw new Error("STUDIO_UNAVAILABLE");
  const value = item.current.values;
  if (
    value.class_id !== identity.id ||
    typeof value.name !== "string" ||
    typeof value.discipline_id !== "string" ||
    typeof value.external_open !== "boolean" ||
    typeof value.waitlist_enabled !== "boolean" ||
    (item.state !== "active" && item.state !== "inactive")
  )
    throw new Error("STUDIO_UNAVAILABLE");
  return {
    ...identity,
    scope,
    kind: "class",
    name: value.name,
    disciplineId: value.discipline_id,
    active: item.state === "active",
    externalOpen: value.external_open,
    waitlist: value.waitlist_enabled,
    effects: value.waitlist_impact,
  };
}

export async function readStudioRooms(
  scope: StudioScope,
  readContext?: AccountReadContext,
  signal = readContext?.signal,
) {
  const backend = await studioBackend(scope, signal, readContext);
  const items = await studioPages((cursor) =>
    queryBackendRead(
      backend,
      "management_state_get_v1",
      {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation: "room_save_v1",
        selector: { operation: "room_save_v1", key: { include_details: true } },
        page: { limit: 50, ...(cursor ? { cursor } : {}) },
      },
      signal,
    ),
  );
  return items.map((item) => roomRecord(scope, item));
}
function readClassRows(
  scope: StudioScope,
  backend: Awaited<ReturnType<typeof studioBackend>>,
  instructorId?: string,
) {
  const operation = "class_save_v1" as const;
  return studioPages((cursor) =>
    backend.call("management_state_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation,
      selector: {
        operation,
        key: {
          include_waitlist: true,
          ...(instructorId ? { class_assignment_instructor_id: instructorId } : {}),
        },
      },
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    }),
  );
}

export async function readStudioInstructorClasses(
  scope: StudioScope,
  instructorId: string,
  signal?: AbortSignal,
) {
  const items = await readClassRows(scope, await studioBackend(scope, signal), instructorId);
  return items.map((item) => ({
    lesson: classRecord(scope, item),
    assignment:
      item.current?.operation === "class_save_v1"
        ? item.current.values.instructor_assignment
        : undefined,
  }));
}

export async function readStudioResources(
  scope: StudioScope,
  readContext?: AccountReadContext,
  readRooms?: () => ReturnType<typeof readStudioRooms>,
) {
  const backend = await studioBackend(scope, undefined, readContext);
  const management = (selector: ManagementSelector, cursor?: string) =>
    backend.call("management_state_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: selector.operation,
      selector,
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    });
  const [rooms, classes, disciplines] = await Promise.all([
    readRooms
      ? readRooms()
      : studioPages((cursor) =>
          management({ operation: "room_save_v1", key: { include_details: true } }, cursor),
        ).then((items) => items.map((item) => roomRecord(scope, item))),
    readClassRows(scope, backend).then((items) => items.map((item) => classRecord(scope, item))),
    studioPages((cursor) =>
      backend.call("disciplines_list_v1", {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: scope.orgId,
        center_id: scope.centerId,
        include_presentation: true,
        page: { limit: 50, ...(cursor ? { cursor } : {}) },
      }),
    ),
  ]);
  // include_presentation explicitly requests center membership; omission is not
  // interpreted as an empty set of eligible disciplines.
  if (disciplines.some((discipline) => !discipline.presentation))
    throw new Error("STUDIO_UNAVAILABLE");
  return {
    rooms,
    classes,
    disciplines,
  };
}
export type StudioResources = Awaited<ReturnType<typeof readStudioResources>>;

export function eligibleDisciplines(items: DisciplineView[]) {
  return items.filter(
    (item) => item.state === "active" && item.presentation?.center?.state === "active",
  );
}

export async function readStudioResource(
  scope: StudioScope,
  kind: ResourceKind,
  id: string,
  readContext?: AccountReadContext,
  signal = readContext?.signal,
) {
  const backend = await studioBackend(scope, signal, readContext);
  const selector: ManagementSelector =
    kind === "room"
      ? { operation: "room_save_v1", key: { room_id: id, include_details: true } }
      : { operation: "class_save_v1", key: { class_id: id, include_waitlist: true } };
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: selector.operation,
    selector,
  });
  if (page.items.length !== 1 || page.next_cursor) throw new Error("STUDIO_UNAVAILABLE");
  const item = page.items[0]!;
  const record = kind === "room" ? roomRecord(scope, item) : classRecord(scope, item);
  if (record.id !== id) throw new Error("STUDIO_UNAVAILABLE");
  return record;
}

export function resourceDraft(base?: ResourceRecord): ResourceDraft {
  return {
    name: base?.name ?? "",
    capacity: base?.kind === "room" && base.capacity !== null ? String(base.capacity) : "",
    disciplineId: base?.kind === "class" ? base.disciplineId : "",
    active: base?.active ?? true,
    externalOpen: base?.kind === "class" ? base.externalOpen : false,
    waitlist: base?.kind === "class" ? base.waitlist : false,
  };
}

export function resourceIntent(
  scope: StudioScope,
  kind: ResourceKind,
  draft: ResourceDraft,
  base?: ResourceRecord,
): ResourceIntent {
  if (
    base &&
    (base.kind !== kind ||
      base.scope.accountId !== scope.accountId ||
      base.scope.orgId !== scope.orgId ||
      base.scope.centerId !== scope.centerId)
  )
    throw new Error("STUDIO_UNAVAILABLE");
  const value = resourceSchema(kind).parse(draft);
  return {
    scope: { ...scope },
    kind,
    draft: { ...value, name: value.name.trim() },
    base,
    key: uuidv7(),
  };
}

export async function saveStudioResource(intent: ResourceIntent) {
  const backend = await studioBackend(intent.scope);
  const common = {
    client_api_version: 1 as const,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    operation_key: intent.key,
    ...(intent.base ? { expected_version: intent.base.version } : {}),
    name: intent.draft.name,
  };
  const result =
    intent.kind === "room"
      ? await backend.call("room_save_v1", {
          ...common,
          ...(intent.base ? { room_id: intent.base.id } : {}),
          capacity: Number(intent.draft.capacity),
          state: intent.draft.active ? "active" : "inactive",
        })
      : await backend.call("class_save_v1", {
          ...common,
          ...(intent.base ? { class_id: intent.base.id } : {}),
          discipline_id: intent.draft.disciplineId,
          external_open: intent.draft.externalOpen,
          // An unrelated rename must not re-run a waitlist closure or rewrite it.
          ...(!intent.base ||
          (intent.base.kind === "class" && intent.base.waitlist !== intent.draft.waitlist)
            ? { waitlist_enabled: intent.draft.waitlist }
            : {}),
        });
  if (!result.primary_id || (intent.base && result.primary_id !== intent.base.id))
    throw new Error("STUDIO_ACK_UNAVAILABLE");
  return result;
}
