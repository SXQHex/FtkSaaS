import { v7 } from "uuid";
import type {
  AvailabilityRule,
  Operations,
  ResourceRef,
  ManagementStateView,
} from "@ftksaas/api-contracts";
import { apiClient, ApiFailure } from "./api";
import { sessionCapacity } from "./session-create";
export const setupWrites = [
  "organization_update_v1",
  "center_create_v1",
  "center_update_v1",
  "room_save_v1",
  "discipline_save_v1",
  "manager_self_assign_center_v1",
  "role_assign_v1",
  "role_revoke_v1",
  "session_assignment_set_v1",
  "center_manager_assign_v1",
  "center_manager_revoke_v1",
  "availability_save_v1",
  "availability_exception_save_v1",
  "policy_publish_v1",
  "center_discipline_set_v1",
  "class_save_v1",
  "program_apply_v1",
  "class_assignment_set_v1",
  "session_create_v1",
] as const;
export type SetupWrite = (typeof setupWrites)[number];
type SetupRead =
  | "organization_get_v1"
  | "centers_list_v1"
  | "disciplines_list_v1"
  | "subscription_get_v1"
  | "program_preview_v1"
  | "role_revoke_preview_v1"
  | "session_get_v1"
  | "roles_list_v1"
  | "people_list_v1"
  | "person_get_v1"
  | "management_state_get_v1"
  | "operation_status_get_v1"
  | "policies_get_v1";
export type SetupInput<K extends SetupWrite | SetupRead> = Omit<
  Operations[K]["request"],
  "request_id" | "client_api_version"
>;
export type SetupCommand = {
  [K in SetupWrite]: { operation: K; input: SetupInput<K> };
}[SetupWrite];
export async function setupCall<K extends SetupWrite | SetupRead>(
  operation: K,
  input: SetupInput<K>,
) {
  const result = await apiClient().call(operation, {
    ...input,
    client_api_version: 1,
    request_id: v7(),
  } as Operations[K]["request"]);
  if (!result.ok) throw new ApiFailure(result);
  return result.data as Operations[K]["response"]["data"];
}
export async function sendSetupCommand(command: SetupCommand) {
  return setupCall(command.operation, command.input);
}
export type SetupScope = { actorId: string; orgId: string; centerId?: string };
export const setupStorageKey = (scope: SetupScope, slot: string) =>
  `ftksaas:setup:v1:${scope.actorId}:${scope.orgId}:${scope.centerId ?? "organization"}:${slot}`;
export type PendingSetup = { command: SetupCommand; blocked?: boolean };
const keyPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fields: Record<SetupWrite, string[]> = {
  organization_update_v1: ["name", "expected_version"],
  center_create_v1: ["name", "timezone"],
  center_update_v1: ["name", "timezone", "expected_version"],
  room_save_v1: ["name", "capacity", "room_id", "expected_version"],
  discipline_save_v1: ["name", "state", "discipline_id", "expected_version"],
  manager_self_assign_center_v1: ["target_center_id"],
  role_assign_v1: ["person_id", "role", "scope"],
  role_revoke_v1: ["assignment_id", "expected_version", "reason", "impact_approval"],
  session_assignment_set_v1: ["session_id", "person_id", "duty", "expected_version"],
  center_manager_assign_v1: ["person_id"],
  center_manager_revoke_v1: ["person_id", "expected_version", "reason"],
  availability_save_v1: ["rule_id", "resource", "rule", "expected_version"],
  availability_exception_save_v1: ["resource", "interval", "reason", "expected_version"],
  policy_publish_v1: ["key", "value", "effective_at", "mandatory"],
  center_discipline_set_v1: ["discipline_id", "state", "expected_version"],
  class_save_v1: ["class_id", "name", "external_open", "discipline_id", "expected_version"],
  program_apply_v1: ["preview"],
  class_assignment_set_v1: ["class_id", "person_id", "duty", "state", "expected_version"],
  session_create_v1: [
    "class_id",
    "interval",
    "resources",
    "assignments",
    "capacity",
    "discipline_id",
    "format",
    "inherit_class_assignments",
  ],
};
export function recoverSetup(scope: SetupScope, slot: string): PendingSetup | "invalid" | null {
  try {
    const raw = sessionStorage.getItem(setupStorageKey(scope, slot));
    if (!raw) return null;
    const value = JSON.parse(raw);
    const command = value?.command;
    const input = command?.input;
    if (
      !setupWrites.includes(command?.operation) ||
      !input ||
      input.org_id !== scope.orgId ||
      (input.center_id !== undefined && input.center_id !== scope.centerId) ||
      !keyPattern.test(input.operation_key) ||
      (value.blocked !== undefined && typeof value.blocked !== "boolean")
    )
      return "invalid";
    if (command.operation === "session_create_v1")
      sessionCapacity(input.capacity.total, input.capacity.categories);
    const allowed = [
      "org_id",
      "center_id",
      "operation_key",
      ...fields[command.operation as SetupWrite],
    ];
    if (Object.keys(input).some((key) => !allowed.includes(key))) return "invalid";
    if (
      input.expected_version !== undefined &&
      (!Number.isSafeInteger(input.expected_version) || input.expected_version < 1)
    )
      return "invalid";
    if (input.name !== undefined && (typeof input.name !== "string" || !input.name.trim()))
      return "invalid";
    if (input.timezone !== undefined && typeof input.timezone !== "string") return "invalid";
    if (
      command.operation !== "session_create_v1" &&
      input.capacity !== undefined &&
      (!Number.isSafeInteger(input.capacity) || input.capacity < 0)
    )
      return "invalid";
    if (
      command.operation === "program_apply_v1" &&
      (!input.preview ||
        typeof input.preview.id !== "string" ||
        typeof input.preview.token !== "string" ||
        !input.preview.token)
    )
      return "invalid";
    if (
      command.operation === "class_save_v1" &&
      (typeof input.name !== "string" ||
        !input.name.trim() ||
        typeof input.external_open !== "boolean" ||
        typeof input.discipline_id !== "string" ||
        !input.discipline_id)
    )
      return "invalid";
    if (
      command.operation === "role_assign_v1" &&
      (input.scope?.center_id !== scope.centerId || input.role !== "instructor")
    )
      return "invalid";
    if (
      command.operation === "manager_self_assign_center_v1" &&
      input.target_center_id !== scope.centerId
    )
      return "invalid";
    if (
      command.operation === "availability_save_v1" &&
      (!input.resource ||
        !["person", "room"].includes(input.resource.kind) ||
        typeof input.resource.id !== "string" ||
        !input.rule ||
        !Array.isArray(input.rule.weekdays))
    )
      return "invalid";
    return value;
  } catch {
    return "invalid";
  }
}
export function setupError(error: unknown) {
  if (error instanceof ApiFailure) return error.failure.error.code;
  return "network";
}
export function isUncertainSetup(error: unknown) {
  return (
    !(error instanceof ApiFailure) ||
    error.failure.error.retryable ||
    [
      "SERVICE_UNAVAILABLE",
      "TEMPORARY_FAILURE",
      "OPERATION_IN_PROGRESS",
      "OPERATION_RESULT_EXPIRED",
      "RESULT_NOT_CONFIRMED",
      "IDEMPOTENCY_PAYLOAD_MISMATCH",
    ].includes(error.failure.error.code)
  );
}
export function weeklyRule(data: FormData): AvailabilityRule {
  const weekdays = data.getAll("weekdays").map(Number);
  const rawStart = String(data.get("start"));
  const start = rawStart.length === 5 ? `${rawStart}:00` : rawStart;
  const rawEnd = String(data.get("end"));
  const end = rawEnd.length === 5 ? `${rawEnd}:00` : rawEnd;
  const from = String(data.get("from"));
  const until = String(data.get("until") || "");
  if (
    !weekdays.length ||
    weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(start) ||
    !/^(?:(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d|24:00:00)$/.test(end) ||
    start >= end ||
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    (until && until < from)
  )
    throw new Error("invalidWeeklyRule");
  return {
    weekdays: [weekdays[0], ...[...new Set(weekdays)].sort().filter((day) => day !== weekdays[0])],
    local_start: start,
    local_end: end,
    valid_from: from,
    valid_until: until || null,
  };
}
export async function getAvailability(orgId: string, centerId: string, resource: ResourceRef) {
  const items: Operations["management_state_get_v1"]["response"]["data"]["items"] = [];
  let cursor: string | null | undefined;
  do {
    const data = await setupCall("management_state_get_v1", {
      org_id: orgId,
      center_id: centerId,
      operation: "availability_save_v1",
      selector: { operation: "availability_save_v1", key: { resource } },
      page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    items.push(...data.items);
    cursor = data.next_cursor;
  } while (cursor);
  return items;
}

export async function getRooms(orgId: string, centerId: string) {
  const items: Operations["management_state_get_v1"]["response"]["data"]["items"] = [];
  let cursor: string | null | undefined;
  do {
    const data = await setupCall("management_state_get_v1", {
      org_id: orgId,
      center_id: centerId,
      operation: "room_save_v1",
      selector: { operation: "room_save_v1", key: {} },
      page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    items.push(...data.items);
    cursor = data.next_cursor;
  } while (cursor);
  return items;
}

export function readableCenterDiscipline(
  item: ManagementStateView | null | undefined,
  disciplineId: string,
) {
  if (
    !item ||
    item.operation !== "center_discipline_set_v1" ||
    item.current?.operation !== "center_discipline_set_v1" ||
    item.current.values.discipline_id !== disciplineId ||
    !Array.isArray(item.versions)
  )
    return false;
  if (item.exists === false)
    return (
      item.entity === null &&
      item.state === null &&
      item.versions.length === 0 &&
      item.current.values.state === undefined
    );
  const version = item.versions[0];
  return (
    item.exists === true &&
    item.entity?.type === "center_disciplines" &&
    ["active", "inactive"].includes(item.state ?? "") &&
    item.current.values.state === item.state &&
    item.versions.length === 1 &&
    version?.entity.type === "center_disciplines" &&
    version.entity.id === item.entity.id &&
    Number.isSafeInteger(version.version) &&
    version.version > 0
  );
}

export async function getCenterDiscipline(orgId: string, centerId: string, disciplineId: string) {
  const data = await setupCall("management_state_get_v1", {
    org_id: orgId,
    center_id: centerId,
    operation: "center_discipline_set_v1",
    selector: { operation: "center_discipline_set_v1", key: { discipline_id: disciplineId } },
    page: { limit: 1, sort: "created_at_asc" },
  });
  const item = data.items[0];
  if (data.items.length !== 1 || !readableCenterDiscipline(item, disciplineId))
    throw Error("unreadableRelation");
  return item;
}

export async function getSetupDisciplines(orgId: string) {
  const items: Operations["disciplines_list_v1"]["response"]["data"]["items"] = [];
  let cursor: string | null | undefined;
  do {
    const data = await setupCall("disciplines_list_v1", {
      org_id: orgId,
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    });
    items.push(...data.items);
    cursor = data.next_cursor;
  } while (cursor);
  return items;
}

export async function getClosures(orgId: string, centerId: string, resource: ResourceRef) {
  const items: Operations["management_state_get_v1"]["response"]["data"]["items"] = [];
  let cursor: string | null | undefined;
  do {
    const data = await setupCall("management_state_get_v1", {
      org_id: orgId,
      center_id: centerId,
      operation: "availability_exception_save_v1",
      selector: { operation: "availability_exception_save_v1", key: { resource } },
      page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    items.push(...data.items);
    cursor = data.next_cursor;
  } while (cursor);
  return items;
}

export function exceptionInterval(start: string, end: string) {
  function instant(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value))
      throw Error("invalidInterval");
    const day = value.slice(0, 10);
    const date = new Date(`${day}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day)
      throw Error("invalidInterval");
    const result = new Date(value);
    if (!Number.isFinite(result.getTime())) throw Error("invalidInterval");
    return result;
  }
  const from = instant(start),
    until = instant(end);
  if (from >= until) throw Error("invalidInterval");
  return { starts_at: from.toISOString(), ends_at: until.toISOString() };
}
