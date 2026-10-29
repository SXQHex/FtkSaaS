import type { PersonView } from "@ftksaas/api-contracts";
import {
  ApiFailure,
  changeStudent,
  getPerson,
  getStudentChangeStatus,
  getStudents,
  type StudentCommand,
} from "./api";

export const studentActions = {
  list: getStudents,
  person: getPerson,
  change: changeStudent,
  status: getStudentChangeStatus,
};
export type StudentActions = typeof studentActions;
export type StudentScope = { actorId: string; orgId: string; centerId: string };
export type PendingStudentChange = { command: StudentCommand; blocked?: boolean };
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
