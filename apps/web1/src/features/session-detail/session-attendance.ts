import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  AttendanceCorrection,
  AttendanceCorrectionRequest,
  AttendanceView,
  AttendanceWindow,
  BlockReason,
  OrdinaryAttendanceResult,
  Preview,
  RequestAttendanceStart,
  RequestAttendanceMark,
  RequestAttendanceBlock,
  RequestAttendanceClose,
  RequestAttendanceCorrectApply,
  RequestAttendanceCorrectionRequest,
  SessionView,
} from "../../lib/api-contracts/generated";
import { readScheduleSession } from "../schedule/schedule-read";
import { readProfileReservation } from "../member-profile/reservations";
import { readProfileRights } from "../member-profile/profile-read";
import { readSessionAttendance } from "./session-detail-read";

function common(scope: ClientScope) {
  return { client_api_version: 1 as const, org_id: scope.orgId, center_id: scope.centerId };
}
type Context = { scope: ClientScope; sessionId: string; before: AttendanceView; people: string[] };
type CorrectionRequestAction =
  | { kind: "submit"; instructorId: string; reason: string }
  | { kind: "review"; request: AttendanceCorrectionRequest; decision: "accepted" | "declined" };
type CorrectionRequestPayload = ReturnType<typeof common> &
  Pick<RequestAttendanceCorrectionRequest, "operation_key" | "session_id"> &
  (
    | { closure_revision: number; reason: string }
    | { correction_request_id: string; expected_version: number; decision: "accepted" | "declined" }
  );
export type SessionAttendanceIntent = Context &
  (
    | { operation: "attendance_start_v1"; request: Omit<RequestAttendanceStart, "request_id"> }
    | { operation: "attendance_mark_v1"; request: Omit<RequestAttendanceMark, "request_id"> }
    | { operation: "attendance_block_v1"; request: Omit<RequestAttendanceBlock, "request_id"> }
    | { operation: "attendance_close_v1"; request: Omit<RequestAttendanceClose, "request_id"> }
    | {
        operation: "attendance_correct_apply_v1";
        request: Omit<RequestAttendanceCorrectApply, "request_id">;
      }
    | {
        operation: "attendance_correction_request_v1";
        request: CorrectionRequestPayload;
        action: CorrectionRequestAction;
      }
  );

export function attendanceWindowState(window: AttendanceWindow | null | undefined, now: number) {
  if (window == null) return undefined;
  if (now < Date.parse(window.opens_at)) return "upcoming";
  return now < Date.parse(window.closes_at) ? "active" : "elapsed";
}

function assertDraftWindow(attendance: AttendanceView) {
  const phase = attendanceWindowState(attendance.attendance_window, Date.now());
  if (phase === "upcoming" || phase === "elapsed")
    throw new Error("SESSION_ATTENDANCE_WINDOW_CLOSED");
}
function context(scope: ClientScope, session: SessionView, attendance: AttendanceView): Context {
  if (
    attendance.session_id !== session.id ||
    attendance.session_version !== session.version ||
    attendance.closure_state !== session.attendance_state
  )
    throw new Error("SESSION_ATTENDANCE_SOURCE_CHANGED");
  return {
    scope: { ...scope },
    sessionId: session.id,
    before: structuredClone(attendance),
    people: [...new Set(attendance.entries.map((row) => row.person_id))],
  };
}
export function attendanceStartIntent(
  scope: ClientScope,
  session: SessionView,
  attendance: AttendanceView,
  reason: string,
  actualStartedAt = new Date().toISOString(),
): SessionAttendanceIntent {
  const base = context(scope, session, attendance);
  assertDraftWindow(attendance);
  if (
    session.state !== "planned" ||
    attendance.actual_started_at ||
    attendance.closure_state !== "open"
  )
    throw new Error("SESSION_ATTENDANCE_SOURCE_CHANGED");
  return {
    ...base,
    operation: "attendance_start_v1",
    request: {
      ...common(scope),
      operation_key: uuidv7(),
      expected_version: session.version,
      session_id: session.id,
      actual_started_at: z.iso.datetime({ offset: true }).parse(actualStartedAt),
      reason: z.string().trim().min(1).parse(reason),
    },
  };
}
export async function attendanceMarkIntent(
  scope: ClientScope,
  session: SessionView,
  attendance: AttendanceView,
  reservationId: string,
  result: OrdinaryAttendanceResult | BlockReason,
): Promise<SessionAttendanceIntent> {
  const base = context(scope, session, attendance),
    entry = attendance.entries.find((row) => row.reservation_id === reservationId);
  if (!entry || !attendance.actual_started_at || attendance.closure_state !== "open")
    throw new Error("SESSION_ATTENDANCE_SOURCE_CHANGED");
  assertDraftWindow(attendance);
  // Mark/block expect the reservation version, not AttendanceEntryView.version.
  const reservation = await readProfileReservation(
    scope,
    entry.person_id,
    entry.reservation_id,
    session.id,
  );
  if (reservation.state !== "active") throw new Error("SESSION_ATTENDANCE_SOURCE_CHANGED");
  const request = {
    ...common(scope),
    operation_key: uuidv7(),
    expected_version: reservation.version,
    reservation_id: reservation.id,
  };
  return result === "attended" || result === "no_show"
    ? { ...base, operation: "attendance_mark_v1", request: { ...request, result } }
    : { ...base, operation: "attendance_block_v1", request: { ...request, reason: result } };
}
export function hasUnmarkedAttendance(attendance: AttendanceView) {
  return attendance.entries.some((row) => row.result === "unmarked");
}

export function attendanceCloseIntent(
  scope: ClientScope,
  session: SessionView,
  attendance: AttendanceView,
  performed: boolean,
  instructorIds: string[],
): SessionAttendanceIntent {
  const base = context(scope, session, attendance);
  if (
    !attendance.actual_started_at ||
    attendance.closure_state !== "open" ||
    hasUnmarkedAttendance(attendance) ||
    new Set(instructorIds).size !== instructorIds.length ||
    instructorIds.some(
      (id) => !session.assignments.some((row) => row.person_id === id && row.duty === "instructor"),
    ) ||
    (!performed && instructorIds.length)
  )
    throw new Error("SESSION_ATTENDANCE_SOURCE_CHANGED");
  return {
    ...base,
    operation: "attendance_close_v1",
    request: {
      ...common(scope),
      operation_key: uuidv7(),
      expected_version: session.version,
      session_id: session.id,
      performed,
      performed_instructor_ids: [...instructorIds],
    },
  };
}
export interface AttendanceReview {
  context: Context;
  corrections: AttendanceCorrection[];
  reason: string;
  preview: Preview;
}
export async function previewAttendanceCorrection(
  scope: ClientScope,
  session: SessionView,
  attendance: AttendanceView,
  corrections: AttendanceCorrection[],
  reason: string,
): Promise<AttendanceReview> {
  const base = context(scope, session, attendance),
    ids = new Set<string>();
  if (attendance.closure_state !== "closed" || !corrections.length)
    throw new Error("SESSION_ATTENDANCE_SOURCE_CHANGED");
  for (const row of corrections) {
    if (
      !attendance.entries.some((entry) => entry.reservation_id === row.reservation_id) ||
      row.result === "unmarked" ||
      ids.has(row.reservation_id) ||
      (row.result === "blocked" && !row.reason)
    )
      throw new Error("SESSION_ATTENDANCE_SOURCE_CHANGED");
    ids.add(row.reservation_id);
  }
  const backend = await scopedBackend(scope),
    text = z.string().trim().min(1).parse(reason);
  const preview = await backend.call("attendance_correct_preview_v1", {
    ...common(scope),
    request_id: uuidv7(),
    session_id: session.id,
    corrections,
    reason: text,
  });
  z.uuid().parse(preview.id);
  z.string().min(1).parse(preview.token);
  z.iso.datetime({ offset: true }).parse(preview.expires_at);
  if (
    !preview.dependencies.versions.some(
      (row) =>
        row.entity.type === "sessions" &&
        row.entity.id === session.id &&
        row.version === session.version,
    )
  )
    throw new Error("SESSION_ATTENDANCE_PREVIEW_UNAVAILABLE");
  return { context: base, corrections: structuredClone(corrections), reason: text, preview };
}
export function attendanceCorrectionIntent(review: AttendanceReview): SessionAttendanceIntent {
  if (review.preview.blockers.length || Date.parse(review.preview.expires_at) <= Date.now())
    throw new Error("SESSION_ATTENDANCE_PREVIEW_UNAVAILABLE");
  return {
    ...structuredClone(review.context),
    operation: "attendance_correct_apply_v1",
    request: {
      ...common(review.context.scope),
      operation_key: uuidv7(),
      preview: { id: review.preview.id, token: review.preview.token },
    },
  };
}

export function attendanceCorrectionRequestIntent(
  scope: ClientScope,
  session: SessionView,
  attendance: AttendanceView,
  action: CorrectionRequestAction,
): SessionAttendanceIntent {
  const base = context(scope, session, attendance);
  const requests = attendance.correction_requests;
  if (attendance.closure_state !== "closed" || attendance.revision < 1 || !requests)
    throw new Error("SESSION_ATTENDANCE_SOURCE_CHANGED");
  const current = requests.filter((row) => row.closure_revision === attendance.revision);
  const request = { ...common(scope), operation_key: uuidv7(), session_id: session.id };
  if (action.kind === "submit") {
    const reason = z.string().trim().min(1).max(1000).parse(action.reason);
    if (
      !session.assignments.some(
        (row) => row.duty === "instructor" && row.person_id === action.instructorId,
      ) ||
      current.some((row) => row.instructor_id === action.instructorId)
    )
      throw new Error("SESSION_ATTENDANCE_SOURCE_CHANGED");
    return {
      ...base,
      operation: "attendance_correction_request_v1",
      action: { ...action, reason },
      request: { ...request, closure_revision: attendance.revision, reason },
    };
  }
  const row = current.find((item) => item.id === action.request.id);
  if (row?.state !== "pending" || row.version !== action.request.version)
    throw new Error("SESSION_ATTENDANCE_SOURCE_CHANGED");
  return {
    ...base,
    operation: "attendance_correction_request_v1",
    action,
    request: {
      ...request,
      correction_request_id: row.id,
      expected_version: row.version,
      decision: action.decision,
    },
  };
}
export async function writeSessionAttendance(intent: SessionAttendanceIntent) {
  const backend = await scopedBackend(intent.scope);
  switch (intent.operation) {
    case "attendance_start_v1":
      return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
    case "attendance_mark_v1":
      return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
    case "attendance_block_v1":
      return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
    case "attendance_close_v1":
      return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
    case "attendance_correct_apply_v1":
      return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
    case "attendance_correction_request_v1":
      return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  }
}
export async function readSessionAttendanceReceipt(intent: SessionAttendanceIntent) {
  const backend = await scopedBackend(intent.scope);
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  const entryOperation =
    intent.operation === "attendance_mark_v1" || intent.operation === "attendance_block_v1";
  const type = entryOperation ? "reservations" : "sessions",
    id = entryOperation ? intent.request.reservation_id : intent.sessionId;
  if (
    receipt.operation !== intent.operation ||
    receipt.key !== intent.request.operation_key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== type || receipt.result_reference.id !== id))
  )
    throw new Error("SESSION_ATTENDANCE_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readSessionAttendanceResult(
  intent: SessionAttendanceIntent,
  readMemberRights = true,
  primaryId?: string,
) {
  const [session, attendance] = await Promise.all([
    readScheduleSession(intent.scope, intent.sessionId),
    readSessionAttendance(intent.scope, intent.sessionId),
  ]);
  context(intent.scope, session, attendance);
  if (intent.operation === "attendance_correction_request_v1") {
    const { action } = intent;
    const row = attendance.correction_requests?.find((candidate) =>
      action.kind === "submit"
        ? candidate.instructor_id === action.instructorId &&
          candidate.reason === action.reason &&
          candidate.closure_revision === intent.before.revision
        : candidate.id === action.request.id &&
          candidate.state === action.decision &&
          candidate.version > action.request.version,
    );
    // A normal ACK names the request. A recovered receipt points to its session.
    if (!row || (primaryId && primaryId !== intent.sessionId && row.id !== primaryId))
      throw new Error("SESSION_ATTENDANCE_RESULT_UNAVAILABLE");
    return { session, attendance, rightsUnavailable: false };
  }
  if (
    session.version <= intent.before.session_version ||
    ((intent.operation === "attendance_mark_v1" || intent.operation === "attendance_block_v1") &&
      !attendance.entries.some((row) => row.reservation_id === intent.request.reservation_id))
  )
    throw new Error("SESSION_ATTENDANCE_RESULT_UNAVAILABLE");
  if (
    intent.operation === "attendance_start_v1" &&
    (!attendance.actual_started_at ||
      Date.parse(attendance.actual_started_at) !== Date.parse(intent.request.actual_started_at))
  )
    throw new Error("SESSION_ATTENDANCE_RESULT_UNAVAILABLE");
  if (
    (intent.operation === "attendance_close_v1" ||
      intent.operation === "attendance_correct_apply_v1") &&
    (attendance.closure_state !== "closed" || attendance.revision <= intent.before.revision)
  )
    throw new Error("SESSION_ATTENDANCE_RESULT_UNAVAILABLE");
  const rights: { personId: string; unavailable: boolean }[] = [];
  for (let i = 0; readMemberRights && i < intent.people.length; i += 4)
    await Promise.all(
      intent.people.slice(i, i + 4).map(async (personId) => {
        try {
          await readProfileRights(intent.scope, personId);
          rights.push({ personId, unavailable: false });
        } catch (failure) {
          if (failure instanceof BackendError && ["FORBIDDEN", "NOT_FOUND"].includes(failure.code))
            rights.push({ personId, unavailable: true });
          else throw failure;
        }
      }),
    );
  return { session, attendance, rightsUnavailable: rights.some((row) => row.unavailable) };
}
