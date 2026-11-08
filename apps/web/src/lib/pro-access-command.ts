import { validate } from "uuid";
export const personnelPermissions = [
  "person.manage",
  "person.activate",
  "invite.student",
  "reservation.write",
  "reservation.capacity_override",
  "attendance.draft",
  "sale.write",
  "finance.collect",
] as const;
export type PersonnelPermission = (typeof personnelPermissions)[number];
export const proAccessWrites = [
  "permission_set_v1",
  "subscription_downgrade_request_v1",
  "subscription_change_cancel_v1",
] as const;
export const proAccessFields = {
  permission_set_v1: ["person_id", "permission", "enabled", "expected_version"],
  subscription_downgrade_request_v1: [
    "target_plan_id",
    "kept_center_id",
    "kept_scope",
    "expected_version",
  ],
  subscription_change_cancel_v1: ["change_id", "expected_version"],
};
const uuid = (v: unknown): v is string => typeof v === "string" && validate(v);
const version = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
export function validProAccessCommand(
  op: string,
  input: Record<string, unknown>,
  centerId: string | undefined,
  slot: string,
) {
  if (!version(input.expected_version)) return false;
  if (op === "permission_set_v1")
    return (
      !!centerId &&
      input.center_id === centerId &&
      uuid(input.person_id) &&
      personnelPermissions.includes(input.permission as PersonnelPermission) &&
      typeof input.enabled === "boolean" &&
      slot === `permission:${input.person_id}:${input.permission}`
    );
  if (centerId || input.center_id != null) return false;
  if (op === "subscription_change_cancel_v1")
    return uuid(input.change_id) && slot === `subscription-cancel:${input.change_id}`;
  if (
    op !== "subscription_downgrade_request_v1" ||
    !uuid(input.target_plan_id) ||
    slot !== `subscription-downgrade:${input.target_plan_id}`
  )
    return false;
  if (input.kept_center_id != null && !uuid(input.kept_center_id)) return false;
  if (input.kept_scope === undefined) return true;
  const s = input.kept_scope as Record<string, unknown> | null;
  return (
    !!s &&
    typeof s === "object" &&
    !Array.isArray(s) &&
    Object.keys(s).length === 4 &&
    ["room_id", "discipline_id", "instructor_id"].every((k) => s[k] === null || uuid(s[k])) &&
    Array.isArray(s.student_person_ids) &&
    s.student_person_ids.length <= 100 &&
    s.student_person_ids.every(uuid) &&
    new Set(s.student_person_ids).size === s.student_person_ids.length &&
    uuid(input.kept_center_id)
  );
}
