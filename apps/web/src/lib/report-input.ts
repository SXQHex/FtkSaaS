import { validate } from "uuid";
import type { ImportMapping, ReportFilters, ReportKind } from "@ftksaas/api-contracts";
export const reportKinds = [
  "collections_debts",
  "lesson_attendance",
  "renewal",
  "occupancy",
  "resource_usage",
  "earnings",
  "crm_conversion",
] as const satisfies readonly ReportKind[];
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function validReportFilters(value: unknown, center?: string): value is ReportFilters {
  if (
    !object(value) ||
    !object(value.interval) ||
    !Array.isArray(value.center_ids) ||
    value.center_ids.some((v) => typeof v !== "string" || !validate(v)) ||
    new Set(value.center_ids).size !== value.center_ids.length ||
    Object.keys(value).some(
      (k) => !["interval", "center_ids", "person_ids", "currency", "state"].includes(k),
    )
  )
    return false;
  const i = value.interval;
  return (
    typeof i.starts_at === "string" &&
    typeof i.ends_at === "string" &&
    Number.isFinite(Date.parse(i.starts_at)) &&
    Number.isFinite(Date.parse(i.ends_at)) &&
    Date.parse(i.ends_at) > Date.parse(i.starts_at) &&
    (center === undefined ||
      value.center_ids.length === 0 ||
      (value.center_ids.length === 1 && value.center_ids[0] === center)) &&
    (value.currency == null ||
      (typeof value.currency === "string" && /^[A-Z]{3}$/.test(value.currency))) &&
    (value.state == null || typeof value.state === "string") &&
    (value.person_ids === undefined ||
      (Array.isArray(value.person_ids) &&
        value.person_ids.every((v) => typeof v === "string" && validate(v))))
  );
}
export const importTargets = [
  "source_key",
  "display_name",
  "person_ref",
  "email",
  "phone",
  "opening_credits",
  "opening_debt_minor",
  "currency",
  "product_version_ref",
  "start_date",
  "end_date",
  "opening_credit_value_minor",
] as const;
export function validateImportMapping(value: unknown): ImportMapping {
  if (
    !object(value) ||
    (value.kind !== undefined && value.kind !== "students") ||
    ![",", ";"].includes(String(value.delimiter)) ||
    !Array.isArray(value.columns) ||
    !value.columns.length ||
    value.columns.length > 100 ||
    Object.keys(value).some((k) => !["kind", "delimiter", "columns"].includes(k))
  )
    throw Error("invalidImport");
  const sources = new Set(),
    targets = new Set();
  for (const c of value.columns) {
    if (
      !object(c) ||
      typeof c.source_column !== "string" ||
      !c.source_column.trim() ||
      Object.keys(c).length !== 2 ||
      !importTargets.some((t) => t === c.target) ||
      sources.has(c.source_column) ||
      (targets.has(c.target) && c.target !== "email" && c.target !== "phone")
    )
      throw Error("invalidImport");
    sources.add(c.source_column);
    targets.add(c.target);
  }
  if (!targets.has("source_key") || !targets.has("display_name")) throw Error("invalidImport");
  return value as unknown as ImportMapping;
}
