import { requireSupabasePublishableKey, requireSupabaseUrl } from "../../lib/public-config";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type AccountReadContext, type ClientScope } from "../../lib/scoped-backend";
import { getBackend, queryBackendRead, readEnvelope } from "../../lib/backend";
import { getSupabaseClient } from "../../lib/supabase";
import type {
  RequestReportExportStart,
  RequestImportPreview,
  RequestImportApply,
  RequestImportUploadPrepare,
  UploadRef,
} from "@ftksaas/api-contracts";
export type ReportJobIntent =
  | {
      scope: ClientScope;
      operation: "report_export_start_v1";
      request: Omit<RequestReportExportStart, "request_id">;
    }
  | {
      scope: ClientScope;
      operation: "import_preview_v1";
      request: Omit<RequestImportPreview, "request_id">;
    }
  | {
      scope: ClientScope;
      operation: "import_apply_v1";
      request: Omit<RequestImportApply, "request_id">;
    };
export const reportsCommon = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
const reportDownload = z.object({ download_path: z.string().min(1), expires_at: z.string() });
const importUpload = z.object({
  file_id: z.uuid(),
  upload_url: z.string().min(1),
  allowed_mime: z.array(z.string()),
  max_bytes: z.number().int().positive(),
  expires_at: z.string(),
});
export async function writeReportJob(intent: ReportJobIntent) {
  const backend = await scopedBackend(intent.scope);
  const request_id = uuidv7();
  const result =
    intent.operation === "report_export_start_v1"
      ? await backend.call(intent.operation, { ...intent.request, request_id })
      : intent.operation === "import_preview_v1"
        ? await backend.call(intent.operation, { ...intent.request, request_id })
        : await backend.call(intent.operation, { ...intent.request, request_id });
  return { primary_id: z.uuid().parse(result.job_id) };
}
export async function reportJobReceipt(intent: ReportJobIntent) {
  const result = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  if (
    result.operation !== intent.operation ||
    result.key !== intent.request.operation_key ||
    (result.result_reference &&
      result.result_reference.type !==
        (intent.operation === "report_export_start_v1" ? "report_jobs" : "import_jobs"))
  )
    throw Error("REPORT_RECEIPT_INVALID");
  return result;
}
export async function readReportJob(intent: ReportJobIntent, id?: string) {
  if (!id) throw Error("REPORT_JOB_UNKNOWN");
  if (intent.operation === "report_export_start_v1" && intent.request.retry_job_id === id)
    throw Error("REPORT_JOB_INVALID");
  return readJob(intent.scope, id);
}
export async function readJob(scope: ClientScope, id: string, readContext?: AccountReadContext) {
  z.uuid().parse(id);
  const backend = await scopedBackend(scope, undefined, readContext);
  const data = await queryBackendRead(
    backend,
    "job_status_get_v1",
    { ...reportsCommon(scope), request_id: uuidv7(), job_id: id },
    readContext?.signal,
  );
  if (data.id !== id) throw Error("REPORT_JOB_INVALID");
  z.enum(["pending", "running", "retry_wait", "succeeded", "failed", "cancelled"]).parse(
    data.state,
  );
  z.number().int().nonnegative().safe().parse(data.progress_count);
  if (data.total_count !== null) z.number().int().nonnegative().safe().parse(data.total_count);
  return data;
}
async function reportFileSession(scope: ClientScope) {
  // Pin the verified native session through the binary POST.
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw Error("AUTH_REQUIRED");
  const bearer = data.session.access_token;
  const base = requireSupabaseUrl();
  const backend = getBackend(bearer);
  const account = await backend.call("account_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
  });
  if (account.id !== scope.accountId) throw Error("ACCOUNT_CHANGED");
  return { backend, base, bearer };
}
export async function downloadReport(scope: ClientScope, jobId: string, key: string) {
  const { backend, base, bearer } = await reportFileSession(scope);
  const request = {
    ...reportsCommon(scope),
    request_id: uuidv7(),
    operation_key: key,
    job_id: z.uuid().parse(jobId),
  };
  const metadata = reportDownload.safeParse(await backend.call("report_file_get_v1", request));
  if (!metadata.success) throw Error("REPORT_DOWNLOAD_INVALID");
  const file = metadata.data;
  const url = new URL(file.download_path, base);
  if (
    url.origin !== new URL(base).origin ||
    url.pathname !== "/functions/v1/backend-v1/report_file_get_v1" ||
    url.search !== "?download=csv" ||
    url.hash ||
    url.username ||
    url.password ||
    !(Date.parse(file.expires_at) > Date.now())
  )
    throw Error("REPORT_DOWNLOAD_INVALID");
  return requestCsv(url, bearer, { ...request, request_id: uuidv7() });
}

export async function downloadSkippedImportRows(scope: ClientScope, jobId: string) {
  const { base, bearer } = await reportFileSession(scope);
  const url = new URL(`${base}/functions/v1/backend-v1/import_rows_list_v1?download=skipped_csv`);
  return requestCsv(url, bearer, {
    ...reportsCommon(scope),
    request_id: uuidv7(),
    job_id: z.uuid().parse(jobId),
    page: { limit: 1 },
    include_apply_summary: true,
  });
}

async function requestCsv(url: URL, bearer: string, request: object) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: {
      authorization: `Bearer ${bearer}`,
      apikey: requireSupabasePublishableKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("text/csv")) {
    await readEnvelope(response);
    throw Error("REPORT_DOWNLOAD_INVALID");
  }
  return response.blob();
}

export interface ImportUploadIntent {
  scope: ClientScope;
  request: Omit<RequestImportUploadPrepare, "request_id">;
  body: Uint8Array<ArrayBuffer>;
  checksum: string;
}
export async function importUploadIntent(
  scope: ClientScope,
  file: File,
  maxBytes: number,
): Promise<ImportUploadIntent> {
  if (!/\.csv$/i.test(file.name) || file.size < 1 || file.size > maxBytes)
    throw Error("IMPORT_FILE_INVALID");
  const body = new Uint8Array(await file.arrayBuffer());
  if (body.byteLength !== file.size) throw Error("IMPORT_FILE_CHANGED");
  const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", body)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    scope: { ...scope },
    request: {
      ...reportsCommon(scope),
      operation_key: uuidv7(),
      filename: file.name,
      mime: "text/csv",
      bytes: body.byteLength,
      checksum,
    },
    body,
    checksum,
  };
}
export async function prepareImport(intent: ImportUploadIntent) {
  const data = await (
    await scopedBackend(intent.scope)
  ).call("import_upload_prepare_v1", { ...intent.request, request_id: uuidv7() });
  const capability = importUpload.safeParse(data);
  if (
    !capability.success ||
    !capability.data.allowed_mime.includes("text/csv") ||
    capability.data.max_bytes < intent.body.byteLength ||
    !(Date.parse(capability.data.expires_at) > Date.now())
  )
    throw Error("IMPORT_UPLOAD_INVALID");
  return data;
}
export async function transferImport(intent: ImportUploadIntent, upload: UploadRef) {
  await scopedBackend(intent.scope);
  const base = new URL(requireSupabaseUrl()),
    url = new URL(upload.upload_url, base);
  if (
    url.origin !== base.origin ||
    url.pathname !==
      `/storage/v1/object/upload/sign/ftksaas-imports/${intent.scope.orgId}/${upload.file_id}` ||
    !url.searchParams.get("token") ||
    url.username ||
    url.password ||
    url.hash ||
    !(Date.parse(upload.expires_at) > Date.now())
  )
    throw Error("IMPORT_UPLOAD_INVALID");
  const result = await fetch(url, {
    method: "PUT",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: { apikey: requireSupabasePublishableKey(), "content-type": "text/csv" },
    body: intent.body,
    signal: AbortSignal.timeout(30000),
  });
  if (!result.ok && result.status !== 409) throw Error("IMPORT_TRANSFER_UNKNOWN");
}
