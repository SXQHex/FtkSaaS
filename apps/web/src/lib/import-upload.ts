import { validate, v7 } from "uuid";
import type { UploadRef } from "@ftksaas/api-contracts";
import { setupCall, type SetupInput, type SetupScope } from "./studio-setup";
import { publicConfig } from "./config";
import { browserClient } from "./supabase/client";
import { ApiFailure } from "./api";
export type ImportUpload = {
  prepare: SetupInput<"import_upload_prepare_v1">;
  completeKey: string;
  fileId?: string;
  phase: "prepare" | "upload" | "complete" | "ready";
};
export const importUploadKey = (scope: SetupScope) =>
  `ftksaas:import-upload:v1:${scope.actorId}:${scope.orgId}:${scope.centerId}`;
export function restoreImportUpload(scope: SetupScope): ImportUpload | null {
  const raw = sessionStorage.getItem(importUploadKey(scope));
  if (!raw) return null;
  const r = JSON.parse(raw),
    p = r?.prepare;
  if (
    !p ||
    p.org_id !== scope.orgId ||
    p.center_id !== scope.centerId ||
    typeof p.filename !== "string" ||
    !p.filename ||
    p.mime !== "text/csv" ||
    !Number.isSafeInteger(p.bytes) ||
    p.bytes < 1 ||
    p.bytes > 2097152 ||
    typeof p.checksum !== "string" ||
    !/^[a-f0-9]{64}$/.test(p.checksum) ||
    !validate(p.operation_key) ||
    !validate(r.completeKey) ||
    !["prepare", "upload", "complete", "ready"].includes(r.phase) ||
    (r.phase !== "prepare" && !validate(r.fileId)) ||
    Object.keys(r).some((k) => !["prepare", "completeKey", "fileId", "phase"].includes(k)) ||
    Object.keys(p).some(
      (k) =>
        !["org_id", "center_id", "operation_key", "filename", "mime", "bytes", "checksum"].includes(
          k,
        ),
    )
  )
    throw Error("invalidImport");
  return r;
}
export async function csvChecksum(file: File) {
  if (file.size < 1 || file.size > 2097152 || !file.name.toLowerCase().endsWith(".csv"))
    throw Error("invalidImport");
  const bytes = new Uint8Array(await file.arrayBuffer());
  new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (bytes.includes(0)) throw Error("invalidImport");
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function importUploadUrl(grant: UploadRef, org: string) {
  const config = publicConfig();
  if (!config || !validate(org) || !validate(grant.file_id)) throw Error("invalidImport");
  const origin = new URL(config.url).origin,
    url = new URL(grant.upload_url, origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname !== `/storage/v1/object/upload/sign/ftksaas-imports/${org}/${grant.file_id}` ||
    !url.searchParams.get("token")
  )
    throw Error("invalidImport");
  return url;
}
export async function newImportUpload(scope: SetupScope, file: File): Promise<ImportUpload> {
  if (!scope.centerId) throw Error("invalidImport");
  return {
    prepare: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: v7(),
      filename: file.name,
      mime: "text/csv",
      bytes: file.size,
      checksum: await csvChecksum(file),
    },
    completeKey: v7(),
    phase: "prepare",
  };
}
export async function continueImportUpload(
  record: ImportUpload,
  file: File | null,
  checkpoint: (v: ImportUpload) => void,
  active: () => boolean,
) {
  let r = record;
  if (r.phase === "ready") return r;
  const complete = () =>
    setupCall("file_upload_complete_v1", {
      org_id: r.prepare.org_id,
      center_id: r.prepare.center_id,
      operation_key: r.completeKey,
      file_id: r.fileId!,
      checksum: r.prepare.checksum,
    });
  if (r.fileId && (r.phase === "upload" || r.phase === "complete")) {
    if (!active()) throw Error("stopped");
    try {
      await complete();
      r = { ...r, phase: "ready" };
      checkpoint(r);
      return r;
    } catch (e) {
      if (
        r.phase === "complete" ||
        !(e instanceof ApiFailure) ||
        e.failure.error.code !== "VALIDATION_FAILED"
      )
        throw e;
    }
  }
  if (
    !file ||
    file.name !== r.prepare.filename ||
    file.size !== r.prepare.bytes ||
    (await csvChecksum(file)) !== r.prepare.checksum
  )
    throw Error("sameFileRequired");
  if (!active()) throw Error("stopped");
  const grant = await setupCall("import_upload_prepare_v1", r.prepare);
  if (
    !Number.isFinite(Date.parse(grant.expires_at)) ||
    Date.parse(grant.expires_at) <= Date.now() ||
    !grant.allowed_mime.includes("text/csv") ||
    file.size > grant.max_bytes ||
    (r.fileId && r.fileId !== grant.file_id)
  )
    throw Error("invalidImport");
  const url = importUploadUrl(grant, r.prepare.org_id);
  r = { ...r, fileId: grant.file_id, phase: "upload" };
  checkpoint(r);
  const bytes = await file.arrayBuffer();
  if (!active()) throw Error("stopped");
  const { error } = await browserClient()
    .storage.from("ftksaas-imports")
    .uploadToSignedUrl(
      `${r.prepare.org_id}/${grant.file_id}`,
      url.searchParams.get("token")!,
      bytes,
      { contentType: "text/csv", upsert: false },
    );
  if (error && !("statusCode" in error && String(error.statusCode) === "409"))
    throw Error("uploadFailed");
  r = { ...r, phase: "complete" };
  checkpoint(r);
  if (!active()) throw Error("stopped");
  await complete();
  r = { ...r, phase: "ready" };
  checkpoint(r);
  return r;
}
