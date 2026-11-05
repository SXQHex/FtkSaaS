import { validate } from "uuid";
export const bookingFields = {
  sale_renew_apply_v1: ["preview"],
  reservation_create_v1: ["person_id", "session_id", "source_sale_id", "mode", "booking_category"],
  reservation_capacity_override_v1: [
    "person_id",
    "session_id",
    "source_sale_id",
    "mode",
    "booking_category",
    "reason",
  ],
  reservation_cancel_v1: ["reservation_id", "expected_version", "reason"],
  lesson_request_create_v1: [
    "person_id",
    "requested_start",
    "duration_minutes",
    "preferred_instructor_id",
    "discipline_id",
    "window_exception",
    "reason",
  ],
  lesson_request_withdraw_v1: ["lesson_request_id", "expected_version"],
  lesson_request_reject_v1: ["lesson_request_id", "expected_version", "reason"],
  lesson_request_offer_alternative_v1: [
    "lesson_request_id",
    "expected_version",
    "alternatives",
    "window_exception",
    "reason",
  ],
  lesson_request_accept_alternative_v1: [
    "lesson_request_id",
    "alternative_id",
    "expected_version",
    "window_exception",
    "reason",
  ],
  lesson_request_approve_v1: [
    "lesson_request_id",
    "expected_version",
    "session_id",
    "booking_category",
  ],
} satisfies Record<string, string[]>;
export type BookingWrite = keyof typeof bookingFields;
export const bookingWrites = Object.keys(bookingFields) as BookingWrite[];
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function uuid(value: unknown) {
  return typeof value === "string" && validate(value);
}
function positive(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}
function text(value: unknown) {
  return typeof value === "string" && !!value.trim();
}
function instant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
export function validBookingCommand(
  operation: BookingWrite,
  value: unknown,
  centerId?: string,
): boolean {
  if (!record(value) || !centerId || value.center_id !== centerId) return false;
  const allowed = ["org_id", "center_id", "operation_key", ...bookingFields[operation]];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return false;
  if (
    value.booking_category !== undefined &&
    !["male", "female"].includes(String(value.booking_category))
  )
    return false;
  if (value.window_exception !== undefined && typeof value.window_exception !== "boolean")
    return false;
  if (value.window_exception === true && !text(value.reason)) return false;
  if (operation === "sale_renew_apply_v1")
    return (
      record(value.preview) &&
      Object.keys(value.preview).length === 2 &&
      uuid(value.preview.id) &&
      text(value.preview.token)
    );
  if (operation.startsWith("reservation_")) {
    if (operation === "reservation_cancel_v1")
      return uuid(value.reservation_id) && positive(value.expected_version) && text(value.reason);
    return (
      uuid(value.person_id) &&
      uuid(value.session_id) &&
      ["flexible", "priority"].includes(String(value.mode)) &&
      (value.source_sale_id == null || uuid(value.source_sale_id)) &&
      (operation !== "reservation_capacity_override_v1" || text(value.reason))
    );
  }
  if (operation === "lesson_request_create_v1")
    return (
      uuid(value.person_id) &&
      uuid(value.discipline_id) &&
      instant(value.requested_start) &&
      positive(value.duration_minutes) &&
      (value.preferred_instructor_id == null || uuid(value.preferred_instructor_id))
    );
  if (!uuid(value.lesson_request_id) || !positive(value.expected_version)) return false;
  if (operation === "lesson_request_reject_v1") return text(value.reason);
  if (operation === "lesson_request_accept_alternative_v1") return uuid(value.alternative_id);
  if (operation === "lesson_request_approve_v1") return uuid(value.session_id);
  if (operation === "lesson_request_offer_alternative_v1")
    return (
      Array.isArray(value.alternatives) &&
      value.alternatives.length > 0 &&
      value.alternatives.every(
        (item) =>
          record(item) &&
          Object.keys(item).every((key) => ["interval", "instructor_id"].includes(key)) &&
          (item.instructor_id == null || uuid(item.instructor_id)) &&
          record(item.interval) &&
          Object.keys(item.interval).length === 2 &&
          instant(item.interval.starts_at) &&
          instant(item.interval.ends_at) &&
          Date.parse(item.interval.starts_at) < Date.parse(item.interval.ends_at),
      )
    );
  return operation === "lesson_request_withdraw_v1";
}
