import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import type {
  Interval,
  ReportFilters,
  ReportKind,
  ReportRow,
  ReportView,
} from "../../lib/api-contracts/generated";
import type { ReportRange } from "./reports-view";
export async function reportInterval(
  timezone: string,
  range: ReportRange | "7",
  from: string,
  to: string,
  anchor: string,
): Promise<Interval> {
  const temporal = await getTemporal();
  const today = temporal.Instant.from(anchor).toZonedDateTimeISO(timezone).toPlainDate();
  const start =
    range === "custom"
      ? temporal.PlainDate.from(from)
      : today.subtract({ days: Number(range) - 1 });
  const last = range === "custom" ? temporal.PlainDate.from(to) : today;
  if (temporal.PlainDate.compare(start, last) > 0 || start.until(last).days > 365)
    throw Error("REPORT_INTERVAL_INVALID");
  return {
    starts_at: start.toZonedDateTime(timezone).toInstant().toString(),
    ends_at: last.add({ days: 1 }).toZonedDateTime(timezone).toInstant().toString(),
  };
}
export const reportRowKey = (row: ReportRow) =>
  JSON.stringify([
    row.group_key,
    row.center_id,
    row.person_id,
    row.currency,
    row.session_id,
    row.product_version_id,
    row.period_start,
  ]);
const instant = z.iso.datetime({ offset: true }),
  count = z.number().int().nonnegative().safe();
const minor = z.string().regex(/^(0|-?[1-9][0-9]*)$/);
export async function readReport(
  scope: ClientScope,
  report: ReportKind,
  filters: ReportFilters,
  cursor?: string,
): Promise<ReportView> {
  if (filters.center_ids.length !== 1 || filters.center_ids[0] !== scope.centerId)
    throw Error("REPORT_SCOPE_INVALID");
  const data = await (
    await scopedBackend(scope)
  ).call("report_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    report,
    ...(report === "crm_conversion" ? { include_crm_funnel: true } : {}),
    filters: structuredClone(filters),
    page: { limit: 20, ...(cursor ? { cursor } : {}) },
  });
  instant.parse(data.as_of);
  instant.parse(data.rows.as_of);
  if (
    data.report_kind !== report ||
    data.rows.items.length > 20 ||
    (cursor && data.rows.next_cursor === cursor) ||
    data.filters.center_ids.length !== 1 ||
    data.filters.center_ids[0] !== scope.centerId ||
    data.filters.interval.starts_at !== filters.interval.starts_at ||
    data.filters.interval.ends_at !== filters.interval.ends_at
  )
    throw Error("REPORT_SOURCE_INVALID");
  if (new Set(data.rows.items.map(reportRowKey)).size !== data.rows.items.length)
    throw Error("REPORT_SOURCE_INVALID");
  for (const row of [...data.rows.items, ...data.totals]) {
    z.string().parse(row.group_key);
    if (row.amount_minor != null) {
      minor.parse(row.amount_minor);
      if (!row.currency) throw Error("REPORT_SOURCE_INVALID");
    }
    if (row.currency != null)
      z.string()
        .regex(/^[A-Z]{3}$/)
        .parse(row.currency);
    if (row.count != null) count.parse(row.count);
    if (row.basis_count != null) count.parse(row.basis_count);
    if (row.ratio_bps != null) count.parse(row.ratio_bps);
  }
  const funnel = data.crm_funnel;
  if (funnel) {
    const { cohort_count, converted_count, stages, sources } = funnel;
    count.parse(cohort_count);
    count.parse(converted_count);
    if (
      report !== "crm_conversion" ||
      converted_count > cohort_count ||
      new Set(stages.map((row) => row.stage_key)).size !== stages.length ||
      new Set(sources.map((row) => row.source)).size !== sources.length ||
      stages.some((row) => count.parse(row.count) > cohort_count) ||
      sources.some((row) => count.parse(row.converted_count) > count.parse(row.count)) ||
      sources.reduce((sum, row) => sum + row.count, 0) !== cohort_count ||
      sources.reduce((sum, row) => sum + row.converted_count, 0) !== converted_count
    )
      throw Error("REPORT_SOURCE_INVALID");
  }
  return data;
}
export async function readImportDirectory(scope: ClientScope, cursor?: string) {
  const data = await (
    await scopedBackend(scope)
  ).call("import_directory_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    page: { limit: 20, ...(cursor ? { cursor } : {}) },
  });
  instant.parse(data.as_of);
  if (
    data.items.length > 20 ||
    new Set(data.items.map((row) => row.job_id)).size !== data.items.length ||
    (cursor && data.next_cursor === cursor)
  )
    throw Error("IMPORT_SOURCE_INVALID");
  if (data.limits) {
    count.positive().parse(data.limits.max_bytes);
    count.positive().parse(data.limits.max_rows);
  }
  for (const row of data.items) {
    z.uuid().parse(row.job_id);
    instant.parse(row.created_at);
    count.parse(row.progress_count);
    if (row.total_count !== null) count.parse(row.total_count);
  }
  return data;
}
