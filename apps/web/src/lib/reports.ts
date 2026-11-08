import type { ReportFilters, ReportKind, ReportView, Operations } from "@ftksaas/api-contracts";
import { validate, v7 } from "uuid";
import { validReportFilters } from "./report-input";
export {
  reportKinds,
  importTargets,
  validateImportMapping,
  validReportFilters,
} from "./report-input";
import { setupCall, type SetupScope } from "./studio-setup";
import { publicConfig } from "./config";
import { browserClient } from "./supabase/client";
export function validateReport(
  report: ReportView,
  kind: ReportKind,
  filters: ReportFilters,
  cursor?: string,
  center?: string,
  layout: ReportLayout = {},
) {
  const centers = filters.center_ids.length ? filters.center_ids : center ? [center] : [];
  if (
    report.report_kind !== kind ||
    !validReportFilters(report.filters) ||
    report.filters.interval.starts_at !== filters.interval.starts_at ||
    report.filters.interval.ends_at !== filters.interval.ends_at ||
    JSON.stringify(report.filters.center_ids) !== JSON.stringify(filters.center_ids) ||
    JSON.stringify(report.filters.person_ids ?? []) !== JSON.stringify(filters.person_ids ?? []) ||
    (report.filters.currency ?? null) !== (filters.currency ?? null) ||
    (report.filters.state ?? null) !== (filters.state ?? null) ||
    !Number.isFinite(Date.parse(report.as_of)) ||
    !Number.isFinite(Date.parse(report.rows.as_of)) ||
    (cursor && report.rows.next_cursor === cursor)
  )
    throw Error("invalidReport");
  for (const row of [...report.rows.items, ...report.totals]) {
    if (
      ("center_id" in row && row.center_id != null && !centers.includes(row.center_id)) ||
      ("person_id" in row &&
        row.person_id != null &&
        (!validate(row.person_id) ||
          (filters.person_ids?.length && !filters.person_ids.includes(row.person_id)))) ||
      (row.currency != null && !/^[A-Z]{3}$/.test(row.currency)) ||
      (filters.currency && row.currency != null && row.currency !== filters.currency) ||
      [
        row.count,
        "credits" in row ? row.credits : null,
        "ratio_bps" in row ? row.ratio_bps : null,
        "basis_count" in row ? row.basis_count : null,
      ].some((v) => v != null && !Number.isSafeInteger(v)) ||
      (row.amount_minor != null &&
        ((!row.currency && (!layout.columns || layout.columns.includes("currency"))) ||
          typeof row.amount_minor !== "string" ||
          !/^-?(0|[1-9]\d*)$/.test(row.amount_minor)))
    )
      throw Error("invalidReport");
  }
  return report;
}
export type ReportLayout = Pick<
  Operations["report_get_v1"]["request"],
  "columns" | "report_order" | "group_by"
>;
export async function readReport(
  scope: SetupScope,
  kind: ReportKind,
  filters: ReportFilters,
  cursor?: string,
  layout: ReportLayout = {},
) {
  if (!scope.centerId || !validReportFilters(filters, scope.centerId)) throw Error("invalidReport");
  return validateReport(
    await setupCall("report_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      report: kind,
      filters,
      ...layout,
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    }),
    kind,
    filters,
    cursor,
    scope.centerId,
    layout,
  );
}
export function privateReportUrl(origin: string, path: string) {
  const base = new URL(origin),
    url = new URL(path, base.origin);
  if (
    url.origin !== base.origin ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname !== "/functions/v1/backend-v1/report_file_get_v1" ||
    url.search !== "?download=csv"
  )
    throw Error("invalidReport");
  return url;
}
export async function downloadReport(scope: SetupScope, jobId: string, expectedFileId: string) {
  const ref = await setupCall("report_file_get_v1", {
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation_key: v7(),
    job_id: jobId,
  });
  if (
    !validate(ref.file_id) ||
    ref.file_id !== expectedFileId ||
    !Number.isFinite(Date.parse(ref.expires_at)) ||
    Date.parse(ref.expires_at) <= Date.now()
  )
    throw Error("OPERATION_RESULT_EXPIRED");
  const config = publicConfig();
  if (!config) throw Error("SERVICE_UNAVAILABLE");
  const url = privateReportUrl(config.url, ref.download_path),
    { data, error } = await browserClient().auth.getSession();
  if (error || !data.session?.access_token) throw Error("AUTH_REQUIRED");
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    cache: "no-store",
    headers: {
      apikey: config.publishableKey,
      authorization: `Bearer ${data.session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_api_version: 1,
      request_id: v7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: v7(),
      job_id: jobId,
    }),
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.startsWith("text/csv") ||
    !response.body
  )
    throw Error(response.status === 403 ? "FORBIDDEN" : "invalidReport");
  const reader = response.body.getReader(),
    chunks: Uint8Array<ArrayBuffer>[] = [],
    max = 24 * 1024 * 1024;
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw Error("invalidReport");
      chunks.push(new Uint8Array(value));
    }
  } finally {
    await reader.cancel();
  }
  return new Blob(chunks, { type: "text/csv;charset=utf-8" });
}
