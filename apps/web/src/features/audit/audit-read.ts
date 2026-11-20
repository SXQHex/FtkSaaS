import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import type { RequestAuditCenterExport, TrackingDirectory } from "@ftksaas/api-contracts";
export const auditModules = [
  "M01",
  "M02",
  "M03",
  "M04",
  "M05",
  "M06",
  "M07",
  "M08",
  "M09",
  "M10",
  "M11",
  "M12",
  "M13",
  "M14",
  "M17",
  "X",
] as const;
const instant = z.iso.datetime({ offset: true });
const count = z.number().int().nonnegative().safe();
export interface AuditInput {
  query?: string;
  module?: string;
  result?: string;
  period: "1" | "7" | "30" | "all";
  anchor: string;
  timezone: string;
  cursor?: string;
}
async function interval(input: AuditInput) {
  if (input.period === "all") return undefined;
  const temporal = await getTemporal();
  const end = temporal.Instant.from(input.anchor);
  const start = end
    .toZonedDateTimeISO(input.timezone)
    .startOfDay()
    .subtract({ days: Number(input.period) - 1 })
    .toInstant();
  // At precisely midnight a valid nonempty interval is still required.
  return {
    starts_at: start.toString(),
    ends_at: end.equals(start) ? end.add({ nanoseconds: 1 }).toString() : end.toString(),
  };
}
function auditScope(scope: ClientScope) {
  return {
    client_api_version: 1 as const,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
  };
}
function pageFor(cursor?: string) {
  return { limit: 20, ...(cursor ? { cursor } : {}) };
}
function validatePage(
  data: { as_of: string; next_cursor?: string | null; items: { id: string; created_at: string }[] },
  cursor?: string,
) {
  instant.parse(data.as_of);
  if (data.items.length > 20 || (cursor && data.next_cursor === cursor))
    throw Error("AUDIT_SOURCE_INVALID");
  for (const item of data.items) {
    z.uuid().parse(item.id);
    instant.parse(item.created_at);
  }
}
async function auditRequest(
  scope: ClientScope,
  input: AuditInput,
): Promise<RequestAuditCenterExport> {
  const request: RequestAuditCenterExport = auditScope(scope);
  const range = await interval(input);
  if (range) request.interval = range;
  if (input.query?.trim()) request.query = z.string().max(200).parse(input.query.trim());
  if (input.module) request.module = z.enum(auditModules).parse(input.module);
  if (input.result) request.result = z.literal("recorded").parse(input.result);
  return request;
}
export async function readAudit(scope: ClientScope, input: AuditInput) {
  const request = await auditRequest(scope, input);
  const data = await (
    await scopedBackend(scope)
  ).call("audit_list_v1", {
    ...request,
    page: pageFor(input.cursor),
  });
  validatePage(data, input.cursor);
  if (new Set(data.items.map((row) => row.id)).size !== data.items.length)
    throw Error("AUDIT_SOURCE_INVALID");
  for (const row of data.items) {
    if (row.result !== "recorded") throw Error("AUDIT_SOURCE_INVALID");
    if (input.module && row.module !== input.module) throw Error("AUDIT_SOURCE_INVALID");
    z.string().parse(row.actor_display);
    z.string().parse(row.subject_title);
  }
  return data;
}
export async function readAuditCsv(scope: ClientScope, input: AuditInput) {
  const request = await auditRequest(scope, input);
  const data = await (await scopedBackend(scope)).call("audit_center_export_v1", request);
  if (data.filename !== `audit-${scope.centerId}.csv` || data.mime !== "text/csv")
    throw Error("AUDIT_SOURCE_INVALID");
  instant.parse(data.as_of);
  count.parse(data.row_count);
  z.string().min(1).parse(data.csv);
  return data;
}
export async function readTracking(
  scope: ClientScope,
  input: AuditInput & { kind?: "all" | "operation" | "preview" | "job"; state?: string },
): Promise<TrackingDirectory> {
  const range = await interval(input);
  const data = await (
    await scopedBackend(scope)
  ).call("tracking_directory_get_v1", {
    ...auditScope(scope),
    page: pageFor(input.cursor),
    kind: input.kind ?? "all",
    ...(range ? { interval: range } : {}),
    ...(input.query?.trim() ? { query: z.string().max(200).parse(input.query.trim()) } : {}),
    ...(input.state?.trim() ? { state: input.state.trim() } : {}),
  });
  validatePage(data, input.cursor);
  if (new Set(data.items.map((row) => `${row.kind}:${row.id}`)).size !== data.items.length)
    throw Error("AUDIT_SOURCE_INVALID");
  for (const value of Object.values(data.summary)) count.parse(value);
  for (const row of data.items) {
    z.enum(["operation", "preview", "job"]).parse(row.kind);
    if (input.kind && input.kind !== "all" && row.kind !== input.kind)
      throw Error("AUDIT_SOURCE_INVALID");
    if (input.state && row.state !== input.state) throw Error("AUDIT_SOURCE_INVALID");
    if (row.expires_at) instant.parse(row.expires_at);
    if (row.next_attempt_at) instant.parse(row.next_attempt_at);
    if (row.progress_count !== null) count.parse(row.progress_count);
    if (row.total_count !== null) count.parse(row.total_count);
    const result = row.import_result;
    if (result) {
      const {
        total_rows,
        applied_rows,
        replayed_rows,
        skipped_rows,
        failed_rows,
        unprocessed_rows,
      } = result;
      z.enum(["complete", "partial", "not_applied"]).parse(result.outcome);
      const counts = [applied_rows, replayed_rows, skipped_rows, failed_rows, unprocessed_rows];
      for (const value of [total_rows, ...counts]) count.parse(value);
      if (
        row.kind !== "job" ||
        row.operation !== "import_rows_process_v1" ||
        (row.state !== "succeeded" && row.state !== "failed") ||
        counts.reduce((sum, value) => sum + value, 0) !== total_rows
      )
        throw Error("AUDIT_SOURCE_INVALID");
    }
    if (
      row.progress_count !== null &&
      row.total_count !== null &&
      row.progress_count > row.total_count
    )
      throw Error("AUDIT_SOURCE_INVALID");
  }
  return data;
}
