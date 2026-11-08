import type { SegmentCondition } from "@ftksaas/api-contracts";
export function segmentOperators(field: SegmentCondition["field"]): SegmentCondition["operator"][] {
  if (field === "active_student") return ["eq", "neq", "is_null"];
  if (field === "remaining_credits") return ["eq", "neq", "lt", "lte", "gt", "gte", "is_null"];
  if (field === "last_attended_at" || field === "entitlement_ends_at")
    return ["lt", "lte", "gt", "gte", "is_null"];
  return ["eq", "neq", "in", "is_null"];
}
export function representableCondition(c: SegmentCondition) {
  if (!segmentOperators(c.field).includes(c.operator)) return false;
  if (c.operator === "is_null") return true;
  if (c.field === "active_student") return typeof c.value === "boolean";
  if (c.field === "remaining_credits") return typeof c.value === "number";
  return c.operator === "in"
    ? Array.isArray(c.value) && c.value.every((v) => typeof v === "string")
    : typeof c.value === "string";
}
export function changeSegmentOperator(
  c: SegmentCondition,
  operator: SegmentCondition["operator"],
): SegmentCondition {
  if (operator === "is_null") return { field: c.field, operator };
  return {
    field: c.field,
    operator,
    value:
      c.field === "active_student"
        ? typeof c.value === "boolean"
          ? c.value
          : true
        : c.field === "remaining_credits"
          ? typeof c.value === "number"
            ? c.value
            : 0
          : operator === "in"
            ? Array.isArray(c.value)
              ? c.value
              : []
            : typeof c.value === "string"
              ? c.value
              : "",
  };
}
