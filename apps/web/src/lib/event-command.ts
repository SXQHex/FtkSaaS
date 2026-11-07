import { validate } from "uuid";
import type { Preview } from "@ftksaas/api-contracts";
export const eventFields = {
  event_save_v1: [
    "expected_version",
    "event_id",
    "name",
    "interval",
    "timezone",
    "venue",
    "capacity",
    "terms",
    "assignments",
    "discipline_ids",
  ],
  event_publish_v1: ["event_id", "published"],
  event_register_v1: ["event_id", "person_id", "sale_id", "preview", "preparation_id"],
  event_registration_cancel_v1: ["expected_version", "registration_id", "reason"],
  event_complete_v1: ["event_id"],
  event_duty_verify_v1: ["assignment_id", "performed", "reason", "expected_version"],
  event_attendance_mark_v1: [
    "expected_version",
    "registration_id",
    "result",
    "record_ineligible_attendance",
    "reason",
  ],
  event_attendance_close_v1: ["expected_version", "event_id"],
  event_attendance_correct_v1: [
    "expected_version",
    "registration_id",
    "result",
    "reason",
    "record_ineligible_attendance",
  ],
  event_payment_prepare_v1: ["event_id", "person_id"],
  event_actual_start_record_v1: ["event_id", "expected_version", "actual_started_at", "reason"],
  event_actual_start_correct_v1: ["event_id", "expected_version", "actual_started_at", "reason"],
  event_cancel_apply_v1: ["preview"],
};
export type EventWrite = keyof typeof eventFields;
export const eventWrites = Object.keys(eventFields) as EventWrite[];
const uuid = (v: unknown): v is string => typeof v === "string" && validate(v);
const text = (v: unknown) => typeof v === "string" && !!v.trim();
const positive = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const instant = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v)) && /(?:Z|[+-]\d\d:\d\d)$/.test(v);
const money = (v: unknown) => typeof v === "string" && /^(?:0|[1-9][0-9]*)$/.test(v);
export function eventPreviewMatches(p: Preview, id: string, version: number) {
  return (
    uuid(p.id) &&
    text(p.token) &&
    Date.parse(p.expires_at) > Date.now() &&
    p.dependencies.versions.some(
      (v) => v.entity.type === "events" && v.entity.id === id && v.version === version,
    )
  );
}
export function validEventCommand(
  op: string,
  input: Record<string, unknown>,
  centerId: string | undefined,
  slot: string,
): boolean {
  if (!centerId || input.center_id !== centerId || !eventWrites.includes(op as EventWrite))
    return false;
  const [, target, person, extra] = slot.split(":");
  if (!target || !uuid(target) || extra) return false;
  if (op === "event_payment_prepare_v1")
    return (
      slot === `event-payment:${input.event_id}:${input.person_id}` &&
      uuid(input.event_id) &&
      uuid(input.person_id)
    );
  if (op === "event_register_v1")
    return (
      slot === `event-register:${input.event_id}:${input.person_id}` &&
      uuid(input.event_id) &&
      uuid(input.person_id) &&
      (input.sale_id == null || uuid(input.sale_id)) &&
      (input.preparation_id == null || uuid(input.preparation_id)) &&
      !(input.sale_id && input.preparation_id) &&
      record(input.preview) &&
      uuid(input.preview.id) &&
      text(input.preview.token) &&
      Object.keys(input.preview).length === 2
    );
  if (
    [
      "event_registration_cancel_v1",
      "event_attendance_mark_v1",
      "event_attendance_correct_v1",
    ].includes(op)
  ) {
    if (slot !== `event-registration:${input.registration_id}`) return false;
  } else if (op === "event_duty_verify_v1") {
    if (slot !== `event-duty:${input.assignment_id}`) return false;
  } else if (person || (!slot.startsWith("event:") && !slot.startsWith("event-create:")))
    return false;
  if (op === "event_cancel_apply_v1")
    return (
      slot.startsWith("event:") &&
      record(input.preview) &&
      uuid(input.preview.id) &&
      text(input.preview.token) &&
      Object.keys(input.preview).length === 2
    );
  if (op === "event_save_v1") {
    if (
      input.event_id
        ? slot !== `event:${input.event_id}` || !positive(input.expected_version)
        : slot !== `event-create:${centerId}` || input.expected_version !== undefined
    )
      return false;
    const c = input.capacity,
      v = input.venue,
      t = input.terms,
      i = input.interval;
    return (
      text(input.name) &&
      record(i) &&
      instant(i.starts_at) &&
      instant(i.ends_at) &&
      Date.parse(String(i.ends_at)) > Date.parse(String(i.starts_at)) &&
      text(input.timezone) &&
      record(c) &&
      record(v) &&
      record(t) &&
      money(t.fee_minor) &&
      text(t.currency) &&
      typeof t.full_payment_required === "boolean" &&
      Array.isArray(t.allowed_product_version_ids) &&
      t.allowed_product_version_ids.every(uuid) &&
      record(t.cancellation) &&
      ["release", "consume"].includes(String(t.cancellation.before_cutoff)) &&
      ["release", "consume"].includes(String(t.cancellation.after_cutoff)) &&
      ["release", "consume"].includes(String(t.cancellation.no_show)) &&
      record(t.refund) &&
      ["none", "credit_ratio", "used_at_unit_price", "time_ratio"].includes(
        String(t.refund.method),
      ) &&
      (t.refund.method !== "used_at_unit_price" || money(t.refund.used_unit_minor)) &&
      ["internal", "external"].includes(String(v.kind)) &&
      (v.kind === "internal"
        ? uuid(v.room_id) && c.kind !== "unlimited"
        : text(v.name) && text(v.address)) &&
      (c.kind === "unlimited" ||
        (Number.isSafeInteger(c.nominal) &&
          Number(c.nominal) >= 0 &&
          Number.isSafeInteger(c.maximum) &&
          Number(c.maximum) >= Number(c.nominal))) &&
      (t.package_usage !== "eligibility_only" ||
        (t.fee_minor === "0" && t.allowed_product_version_ids.length > 0)) &&
      Array.isArray(input.discipline_ids) &&
      input.discipline_ids.every(uuid) &&
      Array.isArray(input.assignments) &&
      input.assignments.every(
        (a) =>
          record(a) &&
          uuid(a.person_id) &&
          ["instructor", "assistant"].includes(String(a.duty)) &&
          money(a.fee_minor) &&
          text(a.currency),
      )
    );
  }
  if (input.event_id !== undefined && slot !== `event:${input.event_id}`) return false;
  if (op === "event_publish_v1")
    return uuid(input.event_id) && typeof input.published === "boolean";
  if (op === "event_complete_v1") return uuid(input.event_id);
  if (!positive(input.expected_version)) return false;
  if (op === "event_attendance_close_v1") return uuid(input.event_id);
  if (op === "event_actual_start_record_v1" || op === "event_actual_start_correct_v1")
    return (
      uuid(input.event_id) &&
      text(input.reason) &&
      (instant(input.actual_started_at) ||
        (op === "event_actual_start_correct_v1" && input.actual_started_at === null))
    );
  if (op === "event_duty_verify_v1")
    return uuid(input.assignment_id) && typeof input.performed === "boolean";
  if (!uuid(input.registration_id)) return false;
  if (op === "event_registration_cancel_v1") return text(input.reason);
  return (
    ["unmarked", "attended", "no_show", "blocked"].includes(String(input.result)) &&
    (op !== "event_attendance_correct_v1" || text(input.reason)) &&
    (input.record_ineligible_attendance !== true ||
      (input.result === "attended" && text(input.reason)))
  );
}
