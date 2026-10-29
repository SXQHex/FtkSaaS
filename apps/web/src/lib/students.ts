import type { PersonView } from "@ftksaas/api-contracts";
import {
  ApiFailure,
  type AccountInvitationCommand,
  createPerson,
  changeStudent,
  getJobStatus,
  getOperationStatus,
  getPerson,
  getStudentChangeStatus,
  getStudents,
  updatePerson,
  sendAccountInvitation,
  type PersonCreateCommand,
  type PersonUpdateCommand,
  type StudentCommand,
} from "./api";

export const studentActions = {
  list: getStudents,
  person: getPerson,
  change: changeStudent,
  status: getStudentChangeStatus,
  update: updatePerson,
  operationStatus: getStudentChangeStatus,
  create: createPerson,
  invite: sendAccountInvitation,
  jobStatus: getJobStatus,
  operationResult: getOperationStatus,
};
export type StudentActions = typeof studentActions;
export type StudentScope = { actorId: string; orgId: string; centerId: string };
export type PendingStudentChange = { command: StudentCommand; blocked?: boolean };
export type PendingPersonUpdate = { command: PersonUpdateCommand; blocked?: boolean };
export type PendingPersonCreate = { command: PersonCreateCommand; blocked?: boolean };
export type PendingAccountInvitation = { command: AccountInvitationCommand; blocked?: boolean };
export function studentState(person: Pick<PersonView, "relationships">, centerId: string) {
  const relationships = person.relationships.filter(
    (item) => item.center_id === centerId && item.kind === "student",
  );
  return relationships.some((item) => item.state === "active")
    ? "active"
    : relationships.length
      ? "inactive"
      : "none";
}
export function studentError(error: unknown) {
  return error instanceof ApiFailure ? error.failure.error.code : "network";
}
export function uncertainStudentChange(error: unknown) {
  return (
    !(error instanceof ApiFailure) ||
    error.failure.error.retryable ||
    [
      "OPERATION_IN_PROGRESS",
      "OPERATION_RESULT_EXPIRED",
      "RESULT_NOT_CONFIRMED",
      "SERVICE_UNAVAILABLE",
      "TEMPORARY_FAILURE",
      "IDEMPOTENCY_PAYLOAD_MISMATCH",
    ].includes(error.failure.error.code)
  );
}
export function studentStorageKey(scope: StudentScope, personId: string) {
  return `ftksaas:student-change:${scope.actorId}:${scope.orgId}:${scope.centerId}:${personId}`;
}
export function personUpdateStorageKey(scope: StudentScope, personId: string) {
  return `ftksaas:person-update:${scope.actorId}:${scope.orgId}:${scope.centerId}:${personId}`;
}
export function personCreateStorageKey(scope: StudentScope) {
  return `ftksaas:person-create:${scope.actorId}:${scope.orgId}:${scope.centerId}`;
}
export function recoverPersonCreate(scope: StudentScope): PendingPersonCreate | "invalid" | null {
  try {
    const raw = sessionStorage.getItem(personCreateStorageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const command = parsed?.command;
    const input = command?.input;
    if (
      command?.operation !== "person_create_v1" ||
      input?.org_id !== scope.orgId ||
      input?.center_id !== scope.centerId ||
      typeof input?.display_name !== "string" ||
      !input.display_name.trim() ||
      !Array.isArray(input.contacts) ||
      input.contacts.some(
        (contact: { kind?: unknown; value?: unknown }) =>
          !contact ||
          !["email", "phone"].includes(String(contact.kind)) ||
          typeof contact.value !== "string",
      ) ||
      typeof input?.operation_key !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        input.operation_key,
      ) ||
      (parsed.blocked !== undefined && typeof parsed.blocked !== "boolean")
    )
      return "invalid";
    return {
      command: {
        operation: "person_create_v1",
        input: {
          org_id: scope.orgId,
          center_id: scope.centerId,
          operation_key: input.operation_key,
          display_name: input.display_name,
          contacts: input.contacts,
        },
      },
      blocked: parsed.blocked,
    };
  } catch {
    return "invalid";
  }
}
export function createdPeopleStorageKey(scope: StudentScope) {
  return `ftksaas:created-people:${scope.actorId}:${scope.orgId}:${scope.centerId}`;
}
export function readCreatedPeople(scope: StudentScope): string[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(createdPeopleStorageKey(scope)) ?? "[]");
    return Array.isArray(value) &&
      value.every(
        (id) =>
          typeof id === "string" &&
          /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id),
      )
      ? value
      : [];
  } catch {
    return [];
  }
}
export function saveCreatedPeople(scope: StudentScope, ids: string[]) {
  sessionStorage.setItem(createdPeopleStorageKey(scope), JSON.stringify([...new Set(ids)]));
}
export function recoverPersonUpdate(
  scope: StudentScope,
  personId: string,
): PendingPersonUpdate | "invalid" | null {
  try {
    const raw = sessionStorage.getItem(personUpdateStorageKey(scope, personId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const command = parsed?.command;
    const input = command?.input;
    const patch = input?.patch;
    if (
      command?.operation !== "person_update_v1" ||
      input?.org_id !== scope.orgId ||
      input?.center_id !== scope.centerId ||
      input?.person_id !== personId ||
      !Number.isSafeInteger(input?.expected_version) ||
      input.expected_version < 1 ||
      typeof input?.operation_key !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        input.operation_key,
      ) ||
      !patch ||
      typeof patch !== "object" ||
      Array.isArray(patch) ||
      (patch.display_name !== undefined &&
        (typeof patch.display_name !== "string" || !patch.display_name.trim())) ||
      (patch.contacts !== undefined &&
        (!Array.isArray(patch.contacts) ||
          patch.contacts.some(
            (contact: { kind?: unknown; value?: unknown }) =>
              !contact ||
              !["email", "phone"].includes(String(contact.kind)) ||
              typeof contact.value !== "string",
          ))) ||
      !Object.keys(patch).length ||
      (parsed.blocked !== undefined && typeof parsed.blocked !== "boolean")
    )
      return "invalid";
    return {
      command: {
        operation: "person_update_v1",
        input: {
          org_id: scope.orgId,
          center_id: scope.centerId,
          person_id: personId,
          expected_version: input.expected_version,
          operation_key: input.operation_key,
          patch: {
            ...(patch.display_name !== undefined ? { display_name: patch.display_name } : {}),
            ...(patch.contacts !== undefined ? { contacts: patch.contacts } : {}),
          },
        },
      },
      blocked: parsed.blocked,
    };
  } catch {
    return "invalid";
  }
}
export function recoverStudentChange(
  scope: StudentScope,
  personId: string,
): PendingStudentChange | "invalid" | null {
  try {
    const raw = sessionStorage.getItem(studentStorageKey(scope, personId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const command = parsed?.command;
    const input = command?.input;
    if (
      !input ||
      !["student_activate_v1", "student_deactivate_v1"].includes(command.operation) ||
      input.org_id !== scope.orgId ||
      input.center_id !== scope.centerId ||
      input.person_id !== personId ||
      typeof input.operation_key !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        input.operation_key,
      ) ||
      (command.operation === "student_deactivate_v1" &&
        (typeof input.reason !== "string" || !input.reason.trim())) ||
      (parsed.blocked !== undefined && typeof parsed.blocked !== "boolean")
    )
      return "invalid";
    const common = {
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
      operation_key: input.operation_key,
    };
    return {
      command:
        command.operation === "student_activate_v1"
          ? { operation: command.operation, input: common }
          : { operation: command.operation, input: { ...common, reason: input.reason } },
      blocked: parsed.blocked,
    };
  } catch {
    return "invalid";
  }
}
