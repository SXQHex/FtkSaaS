import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import { reportsCommon } from "./reports-command";
import type { ImportRowState } from "@ftksaas/api-contracts";
export async function readImportRows(
  scope: ClientScope,
  jobId: string,
  state?: ImportRowState,
  cursor?: string,
  includeApplySummary = false,
  readContext?: AccountReadContext,
) {
  const data = await (
    await scopedBackend(scope, undefined, readContext)
  ).call("import_rows_list_v1", {
    ...reportsCommon(scope),
    request_id: uuidv7(),
    job_id: z.uuid().parse(jobId),
    page: { limit: 20, ...(cursor ? { cursor } : {}) },
    include_details: true,
    ...(includeApplySummary ? { include_apply_summary: true } : {}),
    ...(state ? { state } : {}),
  });
  z.iso.datetime({ offset: true }).parse(data.as_of);
  if (
    data.items.length > 20 ||
    (cursor && data.next_cursor === cursor) ||
    new Set(data.items.map((row) => row.row_number)).size !== data.items.length
  )
    throw Error("IMPORT_ROWS_INVALID");
  for (const row of data.items) {
    z.number().int().positive().safe().parse(row.row_number);
    z.enum(["pending", "valid", "invalid", "applied", "failed"]).parse(row.state);
    if (state && row.state !== state) throw Error("IMPORT_ROWS_INVALID");
  }
  const summary = data.apply_summary;
  if (summary) {
    const { total_rows, applied_rows, skipped_rows, failed_rows, replayed_rows } = summary;
    for (const count of [total_rows, applied_rows, skipped_rows, failed_rows, replayed_rows])
      z.number().int().nonnegative().safe().parse(count);
    if (applied_rows + skipped_rows + failed_rows + replayed_rows !== total_rows)
      throw Error("IMPORT_ROWS_INVALID");
  }
  return data;
}
export async function readImportPreview(scope: ClientScope, previewId: string) {
  const data = await (
    await scopedBackend(scope)
  ).call("preview_get_v1", {
    ...reportsCommon(scope),
    request_id: uuidv7(),
    preview_id: z.uuid().parse(previewId),
  });
  if (data.id !== previewId || !data.import_summary) throw Error("IMPORT_PREVIEW_INVALID");
  z.iso.datetime({ offset: true }).parse(data.expires_at);
  z.string().min(1).parse(data.token);
  const summary = data.import_summary;
  for (const value of [
    summary.total_rows,
    summary.valid_rows,
    summary.invalid_rows,
    summary.new_people,
    summary.replayed_rows,
    summary.opening_credits,
    summary.existing_negative_credits,
  ])
    z.number().int().nonnegative().safe().parse(value);
  if (summary.valid_rows + summary.invalid_rows !== summary.total_rows)
    throw Error("IMPORT_PREVIEW_INVALID");
  return data;
}
