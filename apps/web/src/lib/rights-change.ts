import { validate } from "uuid";
import type {
  CreditProtectionChange,
  NegativeLimitProtectionChange,
  ValidityProtectionChange,
} from "@ftksaas/api-contracts";
export type RightsChange =
  | CreditProtectionChange
  | NegativeLimitProtectionChange
  | ValidityProtectionChange;
export const rightsOperations = [
  "credit_adjust_v1",
  "entitlement_extend_v1",
  "negative_limit_set_v1",
] as const;
function uuid(value: unknown): value is string {
  return typeof value === "string" && validate(value);
}
function count(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum;
}
function date(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 1 &&
    !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function rightsChange(
  kind: RightsChange["kind"],
  target: string,
  value: string,
  direction?: string,
  disciplineId?: string,
): RightsChange {
  if (!uuid(target)) throw Error("invalidRights");
  if (kind === "entitlement_extend") {
    if (!date(value)) throw Error("invalidRights");
    return { kind, sale_id: target, end_date: value };
  }
  if (!/^\d+$/.test(value) || !count(Number(value), kind === "credit_adjust" ? 1 : 0))
    throw Error("invalidRights");
  if (kind === "negative_limit") {
    if (!uuid(disciplineId)) throw Error("invalidRights");
    return {
      kind,
      person_id: target,
      discipline_id: disciplineId,
      allowed_negative_credits: Number(value),
    };
  }
  if (direction !== "increase" && direction !== "decrease") throw Error("invalidRights");
  return { kind, sale_id: target, quantity: Number(value), direction };
}
export function matchesRightsPreview(change: RightsChange, other: unknown) {
  if (!other || typeof other !== "object") return false;
  const a = change as unknown as Record<string, unknown>,
    b = other as Record<string, unknown>;
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => a[key] === b[key])
  );
}
export function validRightsCommand(operation: string, value: unknown, centerId?: string): boolean {
  if (!centerId || !value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  if (
    input.center_id !== centerId ||
    typeof input.reason !== "string" ||
    !input.reason.trim() ||
    input.reason.length > 10000
  )
    return false;
  const proof = input.impact_approval;
  if (!proof || typeof proof !== "object") return false;
  const token = proof as Record<string, unknown>;
  if (
    Object.keys(token).length !== 2 ||
    !uuid(token.id) ||
    typeof token.token !== "string" ||
    !token.token
  )
    return false;
  if (
    !Array.isArray(input.accepted_reservation_ids) ||
    !input.accepted_reservation_ids.every(uuid) ||
    new Set(input.accepted_reservation_ids).size !== input.accepted_reservation_ids.length
  )
    return false;
  const common = [
    "org_id",
    "center_id",
    "operation_key",
    "reason",
    "impact_approval",
    "accepted_reservation_ids",
  ];
  let extra: string[];
  if (operation === "credit_adjust_v1") {
    extra = ["sale_id", "quantity", "direction"];
    if (
      !uuid(input.sale_id) ||
      !count(input.quantity, 1) ||
      !["increase", "decrease"].includes(String(input.direction))
    )
      return false;
  } else if (operation === "entitlement_extend_v1") {
    extra = ["sale_id", "end_date", "expected_version"];
    if (!uuid(input.sale_id) || !date(input.end_date) || !count(input.expected_version, 1))
      return false;
  } else if (operation === "negative_limit_set_v1") {
    extra = ["person_id", "discipline_id", "allowed_negative_credits", "expected_version"];
    if (
      !uuid(input.person_id) ||
      !uuid(input.discipline_id) ||
      !count(input.allowed_negative_credits) ||
      !count(input.expected_version, 1)
    )
      return false;
  } else return false;
  return Object.keys(input).every((key) => [...common, ...extra].includes(key));
}
