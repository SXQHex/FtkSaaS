import { validate, v7 } from "uuid";
import type {
  AttendanceEntryView,
  AttendanceView,
  OrdinaryAttendanceResult,
  SessionView,
} from "@ftksaas/api-contracts";
import type { SetupScope } from "./studio-setup";
import { localTimeChoices } from "./session-change";
export const attendanceWrites = [
  "attendance_start_v1",
  "attendance_mark_v1",
  "attendance_block_v1",
  "attendance_close_v1",
  "attendance_correct_apply_v1",
] as const;
export type AttendanceWrite = (typeof attendanceWrites)[number];
export const attendanceFields = {
  attendance_start_v1: ["session_id", "expected_version", "actual_started_at", "reason"],
  attendance_mark_v1: ["reservation_id", "expected_version", "result"],
  attendance_block_v1: ["reservation_id", "expected_version", "reason"],
  attendance_close_v1: ["session_id", "expected_version", "performed", "performed_instructor_ids"],
  attendance_correct_apply_v1: ["preview"],
};
const positive = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const uuid = (v: unknown): v is string => typeof v === "string" && validate(v);
const reason = (v: unknown) => typeof v === "string" && !!v.trim() && v.length <= 10000;
export function attendanceMatches(view: AttendanceView, sessionId: string, centerId?: string) {
  const ids = new Set<string>();
  return (
    view.session_id === sessionId &&
    positive(view.session_version) &&
    ["open", "closed"].includes(view.closure_state) &&
    Number.isSafeInteger(view.revision) &&
    view.revision >= 0 &&
    (view.actual_started_at == null || Number.isFinite(Date.parse(view.actual_started_at))) &&
    view.entries.every((row) => {
      if (
        !uuid(row.reservation_id) ||
        !uuid(row.person_id) ||
        ids.has(row.reservation_id) ||
        !positive(row.version) ||
        !["unmarked", "attended", "no_show", "blocked"].includes(row.result) ||
        (centerId && row.eligibility_snapshot && row.eligibility_snapshot.center_id !== centerId)
      )
        return false;
      ids.add(row.reservation_id);
      return true;
    })
  );
}
function common(scope: SetupScope) {
  if (!scope.centerId) throw Error("invalidAttendance");
  return { org_id: scope.orgId, center_id: scope.centerId, operation_key: v7() };
}
export function attendanceMark(
  scope: SetupScope,
  view: AttendanceView,
  row: AttendanceEntryView,
  result: OrdinaryAttendanceResult,
) {
  if (
    !attendanceMatches(view, view.session_id, scope.centerId) ||
    view.closure_state !== "open" ||
    !view.entries.includes(row) ||
    !["attended", "no_show"].includes(result) ||
    row.result === "blocked"
  )
    throw Error("invalidAttendance");
  return {
    operation: "attendance_mark_v1" as const,
    input: {
      ...common(scope),
      reservation_id: row.reservation_id,
      expected_version: row.version,
      result,
    },
  };
}
export function attendanceStart(
  scope: SetupScope,
  view: AttendanceView,
  local: string,
  timeZone: string,
  offset: string,
  note: string,
) {
  const choices = localTimeChoices(local, timeZone),
    instant =
      choices.length === 1
        ? choices[0]?.instant
        : choices.find((x) => x.instant === offset)?.instant;
  if (
    !attendanceMatches(view, view.session_id, scope.centerId) ||
    view.closure_state !== "open" ||
    view.actual_started_at !== null ||
    !instant ||
    Date.parse(instant) > Date.now() ||
    !reason(note)
  )
    throw Error("invalidAttendance");
  return {
    operation: "attendance_start_v1" as const,
    input: {
      ...common(scope),
      session_id: view.session_id,
      expected_version: view.session_version,
      actual_started_at: instant,
      reason: note.trim(),
    },
  };
}
export function attendanceClose(
  scope: SetupScope,
  view: AttendanceView,
  session: SessionView,
  performed: string,
  instructors: string[],
) {
  const roster = new Set(
    session.assignments.filter((x) => x.duty === "instructor").map((x) => x.person_id),
  );
  if (
    !attendanceMatches(view, session.id, scope.centerId) ||
    view.closure_state !== "open" ||
    session.state !== "planned" ||
    view.entries.some((x) => x.result === "unmarked") ||
    !["yes", "no"].includes(performed) ||
    new Set(instructors).size !== instructors.length ||
    instructors.some((id) => !roster.has(id)) ||
    (performed === "no" && instructors.length > 0)
  )
    throw Error("invalidAttendance");
  return {
    operation: "attendance_close_v1" as const,
    input: {
      ...common(scope),
      session_id: session.id,
      expected_version: view.session_version,
      performed: performed === "yes",
      performed_instructor_ids: instructors,
    },
  };
}
export function validAttendanceCommand(
  op: AttendanceWrite,
  input: Record<string, unknown>,
  centerId: string | undefined,
  slot: string,
) {
  if (!centerId || input.center_id !== centerId) return false;
  if (op === "attendance_correct_apply_v1") {
    const p = input.preview as Record<string, unknown> | undefined;
    return (
      /^attendance:[^:]+$/.test(slot) &&
      uuid(slot.slice(11)) &&
      !!p &&
      typeof p === "object" &&
      !Array.isArray(p) &&
      Object.keys(p).length === 2 &&
      uuid(p.id) &&
      typeof p.token === "string" &&
      !!p.token.trim()
    );
  }
  if (!positive(input.expected_version)) return false;
  if (op === "attendance_mark_v1" || op === "attendance_block_v1")
    return (
      uuid(input.reservation_id) &&
      slot === `attendance-row:${input.reservation_id}` &&
      (op === "attendance_mark_v1"
        ? typeof input.result === "string" && ["attended", "no_show"].includes(input.result)
        : typeof input.reason === "string" &&
          ["debt_policy", "credit_limit_exceeded"].includes(input.reason))
    );
  if (!uuid(input.session_id) || slot !== `attendance:${input.session_id}`) return false;
  if (op === "attendance_start_v1")
    return (
      reason(input.reason) &&
      typeof input.actual_started_at === "string" &&
      /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.actual_started_at) &&
      Number.isFinite(Date.parse(input.actual_started_at))
    );
  return (
    typeof input.performed === "boolean" &&
    Array.isArray(input.performed_instructor_ids) &&
    input.performed_instructor_ids.every(uuid) &&
    new Set(input.performed_instructor_ids).size === input.performed_instructor_ids.length &&
    (input.performed || input.performed_instructor_ids.length === 0)
  );
}
