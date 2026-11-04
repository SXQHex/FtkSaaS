import type { Operations, UploadRef } from "@ftksaas/api-contracts";
import { ApiFailure } from "./api";
import { publicConfig } from "./config";
import { browserClient } from "./supabase/client";
import { setupCall, type SetupScope } from "./studio-setup";
export type PrepareDocument = Omit<
  Operations["document_upload_prepare_v1"]["request"],
  "request_id" | "client_api_version"
>;
export type DocumentPublication = Omit<
  Operations["document_publication_preview_v1"]["request"],
  "request_id" | "client_api_version"
>;
export type UploadJournal = {
  prepare: PrepareDocument;
  checksum: string;
  completeKey: string;
  phase: "prepare" | "upload" | "complete" | "ready";
  fileId?: string;
  expiresAt?: string;
  documentId?: string;
  blocked?: boolean;
  restartable?: boolean;
};
export const uploadStorageKey = (scope: SetupScope) =>
  `ftksaas:document-upload:v1:${scope.actorId}:${scope.orgId}:${scope.centerId ?? "organization"}`;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const key = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function restoreUpload(scope: SetupScope): UploadJournal | "invalid" | null {
  try {
    const raw = sessionStorage.getItem(uploadStorageKey(scope));
    if (!raw) return null;
    const value = JSON.parse(raw),
      p = value?.prepare;
    if (
      !value ||
      !p ||
      p.org_id !== scope.orgId ||
      p.center_id !== scope.centerId ||
      !key.test(p.operation_key) ||
      !key.test(value.completeKey) ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      !["application/pdf", "text/plain"].includes(p.mime) ||
      !Number.isSafeInteger(p.bytes) ||
      p.bytes < 1 ||
      p.bytes > 2097152 ||
      typeof value.checksum !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.checksum) ||
      !["prepare", "upload", "complete", "ready"].includes(value.phase) ||
      (value.phase !== "prepare" && !uuid.test(value.fileId)) ||
      (value.fileId !== undefined && !uuid.test(value.fileId)) ||
      (value.documentId !== undefined && !uuid.test(value.documentId)) ||
      (value.expiresAt !== undefined && !Number.isFinite(Date.parse(value.expiresAt))) ||
      (value.blocked !== undefined && typeof value.blocked !== "boolean") ||
      (value.restartable !== undefined && typeof value.restartable !== "boolean") ||
      Object.keys(value).some(
        (k) =>
          ![
            "prepare",
            "checksum",
            "completeKey",
            "phase",
            "fileId",
            "expiresAt",
            "documentId",
            "blocked",
            "restartable",
          ].includes(k),
      ) ||
      Object.keys(p).some(
        (k) => !["org_id", "center_id", "operation_key", "name", "mime", "bytes"].includes(k),
      )
    )
      return "invalid";
    return value;
  } catch {
    return "invalid";
  }
}
export function documentUploadUrl(grant: UploadRef, orgId: string) {
  const config = publicConfig();
  if (!config || !uuid.test(orgId) || !uuid.test(grant.file_id)) throw Error("invalidUpload");
  const origin = new URL(config.url).origin;
  const url = new URL(grant.upload_url, origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname !== `/storage/v1/object/upload/sign/ftksaas-documents/${orgId}/${grant.file_id}` ||
    !url.searchParams.get("token")
  )
    throw Error("invalidUpload");
  return url;
}
export async function documentFileHash(file: File) {
  if (
    !["application/pdf", "text/plain"].includes(file.type) ||
    file.size < 1 ||
    file.size > 2097152
  )
    throw Error("invalidFile");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === "application/pdf" && new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw Error("invalidFile");
  if (file.type === "text/plain") {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (bytes.includes(0)) throw Error("invalidFile");
  }
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function continueDocumentUpload(
  scope: SetupScope,
  journal: UploadJournal,
  file: File | null,
  checkpoint: (record: UploadJournal) => void,
  active: () => boolean = () => true,
) {
  let record = journal;
  if (record.blocked) throw Error("blockedUpload");
  if (record.phase === "ready") return record;
  if (record.phase === "upload" && record.fileId) {
    // The transfer may have succeeded before its reply was lost. Validate the object
    // before requesting a second signed grant, which cannot overwrite an existing key.
    record = { ...record, phase: "complete" };
    checkpoint(record);
    if (!active()) throw Error("stopped");
    try {
      await setupCall("file_upload_complete_v1", {
        org_id: scope.orgId,
        ...(scope.centerId ? { center_id: scope.centerId } : {}),
        file_id: record.fileId!,
        operation_key: record.completeKey,
        checksum: record.checksum,
      });
      record = { ...record, phase: "ready" };
      checkpoint(record);
      return record;
    } catch (cause) {
      if (!(cause instanceof ApiFailure) || cause.failure.error.code !== "VALIDATION_FAILED")
        throw cause;
      record = { ...record, phase: "upload" };
      checkpoint(record);
    }
  }

  if (record.phase !== "complete") {
    if (
      !file ||
      file.name !== record.prepare.name ||
      file.type !== record.prepare.mime ||
      file.size !== record.prepare.bytes ||
      (await documentFileHash(file)) !== record.checksum
    )
      throw Error("sameFileRequired");
    if (!active()) throw Error("stopped");
    const grant = await setupCall("document_upload_prepare_v1", record.prepare);
    if (
      !Number.isFinite(Date.parse(grant.expires_at)) ||
      Date.parse(grant.expires_at) <= Date.now() ||
      !grant.allowed_mime.includes(file.type) ||
      file.size > grant.max_bytes ||
      (record.fileId && record.fileId !== grant.file_id)
    )
      throw Error("invalidUpload");
    const url = documentUploadUrl(grant, scope.orgId);
    record = { ...record, phase: "upload", fileId: grant.file_id, expiresAt: grant.expires_at };
    checkpoint(record);
    const bytes = await file.arrayBuffer();
    if (!active()) throw Error("stopped");
    const { error } = await browserClient()
      .storage.from("ftksaas-documents")
      .uploadToSignedUrl(`${scope.orgId}/${grant.file_id}`, url.searchParams.get("token")!, bytes, {
        contentType: file.type,
        upsert: false,
      });
    // A lost transfer reply may leave the object present. Only backend completion can validate it.
    const existing =
      error &&
      (("statusCode" in error && String(error.statusCode) === "409") ||
        ("code" in error &&
          ["ResourceAlreadyExists", "KeyAlreadyExists"].includes(String(error.code))));
    if (error && !existing) throw Error("uploadFailed");
    record = { ...record, phase: "complete" };
    checkpoint(record);
  }
  if (!record.fileId) throw Error("invalidUpload");
  if (!active()) throw Error("stopped");
  await setupCall("file_upload_complete_v1", {
    org_id: scope.orgId,
    ...(scope.centerId ? { center_id: scope.centerId } : {}),
    operation_key: record.completeKey,
    file_id: record.fileId,
    checksum: record.checksum,
  });
  record = { ...record, phase: "ready" };
  checkpoint(record);
  return record;
}
export function listDocumentFiles(scope: SetupScope, cursor?: string) {
  return setupCall("management_state_get_v1", {
    org_id: scope.orgId,
    ...(scope.centerId ? { center_id: scope.centerId } : {}),
    operation: "document_upload_prepare_v1",
    selector: { operation: "document_upload_prepare_v1", key: {} },
    page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
}
export function listDocumentPublications(scope: SetupScope, fileId: string, cursor?: string) {
  return setupCall("management_state_get_v1", {
    org_id: scope.orgId,
    ...(scope.centerId ? { center_id: scope.centerId } : {}),
    operation: "document_version_publish_v1",
    selector: {
      operation: "document_version_publish_v1",
      key: {
        file_id: fileId,
        scope: scope.centerId
          ? { kind: "center", center_id: scope.centerId }
          : { kind: "organization" },
      },
    },
    page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
}

export const previewDocumentPublication = (input: DocumentPublication) =>
  setupCall("document_publication_preview_v1", input);

export async function reconcileDocumentUpload(
  scope: SetupScope,
  record: UploadJournal,
): Promise<UploadJournal> {
  const operation =
    record.phase === "prepare" ? "document_upload_prepare_v1" : "file_upload_complete_v1";
  const key =
    operation === "document_upload_prepare_v1" ? record.prepare.operation_key : record.completeKey;
  const status = await setupCall("operation_status_get_v1", {
    org_id: scope.orgId,
    operation,
    key,
  });
  if (status.operation !== operation || status.key !== key) throw Error("checkFailed");
  if (status.status === "in_progress") return record;
  if (status.status === "failed_final") return { ...record, blocked: true, restartable: true };
  const fileId =
    record.fileId ??
    (status.result_reference?.type === "files" ? status.result_reference.id : undefined);
  if (
    !fileId ||
    (status.result_reference &&
      (status.result_reference.type !== "files" || status.result_reference.id !== fileId))
  )
    throw Error("checkFailed");
  const page = await setupCall("management_state_get_v1", {
    org_id: scope.orgId,
    ...(scope.centerId ? { center_id: scope.centerId } : {}),
    operation: "file_upload_complete_v1",
    selector: { operation: "file_upload_complete_v1", key: { file_id: fileId } },
    page: { limit: 1 },
  });
  const item = page.items.find(
    (item) =>
      item.exists &&
      item.entity?.type === "files" &&
      item.entity.id === fileId &&
      item.current?.operation === "file_upload_complete_v1" &&
      item.current.values.file_id === fileId,
  );
  if (!item || item.current?.operation !== "file_upload_complete_v1") throw Error("checkFailed");
  if (item.state === "ready" && item.current.values.checksum === record.checksum)
    return { ...record, fileId, phase: "ready", blocked: false, restartable: false };
  // Prepare creates an expiring private file only. After its completed receipt is
  // proven and no completion was ever sent, the user may explicitly abandon it.
  if (
    operation === "document_upload_prepare_v1" &&
    status.status === "succeeded" &&
    item.state === "pending_upload"
  )
    return { ...record, fileId, restartable: true };
  return status.status === "result_expired" ? { ...record, blocked: true } : record;
}
