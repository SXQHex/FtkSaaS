import type { AttendanceEntryView, AttendanceView, Preview } from "@ftksaas/api-contracts";
import { ApiFailure } from "./api";
import { attendanceMatches } from "./attendance-command";
import { setupCall, type SetupScope, type SetupInput } from "./studio-setup";
import { readEntitlements } from "./products";
export type AttendanceAction =
  | "attendance_start_v1"
  | "attendance_mark_v1"
  | "attendance_block_v1"
  | "attendance_close_v1"
  | "attendance_correct_preview_v1";
export const attendanceApi = {
  read: async (scope: SetupScope, sessionId: string) => {
    const [session, view] = await Promise.all([
      setupCall("session_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        session_id: sessionId,
      }),
      setupCall("attendance_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        session_id: sessionId,
      }),
    ]);
    if (session.id !== sessionId || !attendanceMatches(view, sessionId, scope.centerId))
      throw Error("invalidAttendance");
    if (session.version !== view.session_version || session.attendance_state !== view.closure_state)
      throw Error("VERSION_CONFLICT");
    return { session, view };
  },
  access: async (scope: SetupScope, operation: AttendanceAction, target: string) => {
    const selector =
      operation === "attendance_mark_v1" || operation === "attendance_block_v1"
        ? { operation, key: { reservation_id: target } }
        : { operation, key: { session_id: target } };
    try {
      const page = await setupCall("management_state_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation,
        selector,
      });
      return page.items.some(
        (item) =>
          item.operation === operation &&
          item.current?.operation === operation &&
          Object.entries(selector.key).every(([key, value]) =>
            Object.entries(item.current!.values).some(([k, v]) => k === key && v === value),
          ),
      );
    } catch (cause) {
      if (
        cause instanceof ApiFailure &&
        ["FORBIDDEN", "NOT_FOUND"].includes(cause.failure.error.code)
      )
        return false;
      throw cause;
    }
  },
  preview: (
    scope: SetupScope,
    input: Omit<SetupInput<"attendance_correct_preview_v1">, "org_id" | "center_id">,
  ) =>
    setupCall("attendance_correct_preview_v1", {
      ...input,
      org_id: scope.orgId,
      center_id: scope.centerId,
    }),
  rights: async (scope: SetupScope, view: AttendanceView) =>
    Promise.all(
      [...new Set(view.entries.map((x) => x.person_id))].map(async (personId) => {
        const rows = await readEntitlements(scope, personId);
        if (
          rows.some(
            (row) =>
              row.person_id !== personId ||
              ![row.available, row.reserved, row.consumed].every(
                (v) => Number.isSafeInteger(v) && v >= 0,
              ),
          )
        )
          throw Error("invalidAttendance");
        return { personId, rows };
      }),
    ),
};
export type AttendanceApi = typeof attendanceApi;
export function correctionRequest(
  view: AttendanceView,
  row: AttendanceEntryView,
  result: string,
  blockReason: string,
  reason: string,
): Omit<SetupInput<"attendance_correct_preview_v1">, "org_id" | "center_id"> {
  if (
    view.closure_state !== "closed" ||
    !view.entries.includes(row) ||
    !reason.trim() ||
    reason.length > 10000 ||
    !["attended", "no_show", "blocked"].includes(result) ||
    (result === "blocked" && !["debt_policy", "credit_limit_exceeded"].includes(blockReason))
  )
    throw Error("invalidAttendance");
  return {
    session_id: view.session_id,
    reason: reason.trim(),
    corrections: [
      {
        reservation_id: row.reservation_id,
        result: result as "attended" | "no_show" | "blocked",
        ...(result === "blocked"
          ? { reason: blockReason as "debt_policy" | "credit_limit_exceeded" }
          : {}),
      },
    ],
  };
}
export function correctionMatches(preview: Preview, sessionId: string) {
  return preview.dependencies.versions.some(
    (x) =>
      x.entity.type === "sessions" &&
      x.entity.id === sessionId &&
      Number.isSafeInteger(x.version) &&
      x.version > 0,
  );
}
