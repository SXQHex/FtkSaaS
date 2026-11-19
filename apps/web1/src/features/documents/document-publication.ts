import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  DigitalDocumentContent,
  DocumentGate,
  DocumentRequirement,
  RequestDocumentUploadPrepare,
  RequestFileUploadComplete,
  RequestDocumentVersionPublish,
  SuccessDocumentPublicationPreview,
  UploadRef,
} from "../../lib/api-contracts/generated";
import { matchesDocumentText, readDocumentCatalog } from "./document-catalog";
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
const maxBytes = 2 * 1024 * 1024;
export interface UploadIntent {
  scope: ClientScope;
  request: Omit<RequestDocumentUploadPrepare, "request_id">;
  body: Uint8Array<ArrayBuffer>;
  checksum: string;
}
export async function uploadIntent(
  scope: ClientScope,
  name: string,
  file: File,
  level: "center" | "organization" = "center",
): Promise<UploadIntent> {
  const mime = z.enum(["application/pdf", "text/plain"]).parse(file.type);
  z.number().int().min(1).max(maxBytes).parse(file.size);
  const body = new Uint8Array(await file.arrayBuffer());
  if (body.byteLength !== file.size) throw Error("DOCUMENT_FILE_CHANGED");
  const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", body)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return {
    scope: structuredClone(scope),
    request: {
      ...common(scope),
      ...(level === "organization" ? { center_id: null } : {}),
      operation_key: uuidv7(),
      name: z.string().trim().min(1).max(500).parse(name),
      mime,
      bytes: body.byteLength,
    },
    body,
    checksum,
  };
}
// A lost prepare response is recovered by replaying this same frozen key, which renews
// the native signed capability. A status receipt alone cannot recover an upload URL.
export async function prepareUpload(intent: UploadIntent) {
  const backend = await scopedBackend(intent.scope);
  const upload = await backend.call("document_upload_prepare_v1", {
    ...intent.request,
    request_id: uuidv7(),
  });
  z.uuid().parse(upload.file_id);
  if (
    !upload.allowed_mime.includes(intent.request.mime) ||
    upload.max_bytes < intent.body.byteLength ||
    !(Date.parse(upload.expires_at) > Date.now())
  )
    throw Error("DOCUMENT_UPLOAD_UNAVAILABLE");
  return upload;
}
export function uploadUrl(
  scope: ClientScope,
  upload: UploadRef,
  base = import.meta.env.VITE_SUPABASE_URL,
) {
  const origin = new URL(base);
  const url = new URL(upload.upload_url, origin);
  const path = `/storage/v1/object/upload/sign/ftksaas-documents/${scope.orgId}/${upload.file_id}`;
  if (
    url.origin !== origin.origin ||
    url.pathname !== path ||
    url.username ||
    url.password ||
    url.hash ||
    !url.searchParams.get("token")
  )
    throw Error("DOCUMENT_UPLOAD_UNAVAILABLE");
  return url;
}
export async function transferUpload(intent: UploadIntent, upload: UploadRef) {
  await scopedBackend(intent.scope);
  if (!(Date.parse(upload.expires_at) > Date.now())) throw Error("DOCUMENT_UPLOAD_EXPIRED");
  const result = await fetch(uploadUrl(intent.scope, upload), {
    method: "PUT",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "content-type": intent.request.mime,
    },
    body: intent.body,
  });
  // A duplicate object may be a previous successful transfer whose response was lost.
  // Only native completion validates the stored bytes; 409 is never a success receipt.
  if (!result.ok && result.status !== 409) throw Error("DOCUMENT_TRANSFER_UNCONFIRMED");
}
export interface CompleteIntent {
  scope: ClientScope;
  request: Omit<RequestFileUploadComplete, "request_id">;
}
export function completeIntent(intent: UploadIntent, upload: UploadRef): CompleteIntent {
  return {
    scope: structuredClone(intent.scope),
    request: {
      ...common(intent.scope),
      center_id: intent.request.center_id,
      operation_key: uuidv7(),
      file_id: upload.file_id,
      checksum: intent.checksum,
    },
  };
}
export async function writeComplete(intent: CompleteIntent) {
  const backend = await scopedBackend(intent.scope);
  return backend.call("file_upload_complete_v1", { ...intent.request, request_id: uuidv7() });
}
export async function readComplete(intent: CompleteIntent, id?: string) {
  if (id && id !== intent.request.file_id) throw Error("DOCUMENT_RESULT_UNAVAILABLE");
  const backend = await scopedBackend(intent.scope);
  const result = await backend.call("management_state_get_v1", {
    ...common(intent.scope),
    center_id: intent.request.center_id,
    request_id: uuidv7(),
    operation: "file_upload_complete_v1",
    selector: { operation: "file_upload_complete_v1", key: { file_id: intent.request.file_id } },
    page: { limit: 1 },
  });
  const row = result.items.find(
    (r) => r.entity?.type === "files" && r.entity.id === intent.request.file_id,
  );
  if (
    !row?.exists ||
    row.state !== "ready" ||
    row.current?.operation !== "file_upload_complete_v1" ||
    row.current.values.file_id !== intent.request.file_id ||
    row.current.values.checksum !== intent.request.checksum
  )
    throw Error("DOCUMENT_RESULT_UNAVAILABLE");
  return intent.request.file_id;
}
export const validDigitalDocumentText = (value: string) =>
  Boolean(value.trim()) && new TextEncoder().encode(value).byteLength <= 262144;

export type PublicationTarget = {
  scope: ClientScope;
  documentId?: string;
  versionLabel: string;
  gates: DocumentGate[];
  renewedAcceptance: boolean;
  level?: "center" | "organization";
  baseRequirements?: DocumentRequirement[];
} & (
  | { fileId: string; digitalContent?: never }
  | { fileId?: never; digitalContent: DigitalDocumentContent }
);

function publicationRequest(target: PublicationTarget) {
  if (!target.gates.length || new Set(target.gates).size !== target.gates.length)
    throw Error("DOCUMENT_REQUIREMENTS_REQUIRED");
  const gates = z
    .array(z.enum(["sale", "reservation", "attendance", "event_registration"]))
    .parse(target.gates);
  return {
    ...common(target.scope),
    ...(target.level === "organization" ? { center_id: null } : {}),
    ...(target.digitalContent
      ? { digital_content: structuredClone(target.digitalContent) }
      : { file_id: z.uuid().parse(target.fileId) }),
    ...(target.documentId ? { document_id: z.uuid().parse(target.documentId) } : {}),
    version_label: z.string().trim().min(1).max(500).parse(target.versionLabel),
    scope:
      target.level === "organization"
        ? { kind: "organization" as const }
        : { kind: "center" as const, center_id: target.scope.centerId },
    requirements: gates.flatMap((gate) => {
      const existing = target.baseRequirements?.filter((row) => row.gate === gate);
      return existing?.length
        ? existing.map((row) => ({
            ...structuredClone(row),
            renewed_acceptance: target.renewedAcceptance,
          }))
        : [
            {
              gate,
              scope: { center_ids: [target.scope.centerId] },
              renewed_acceptance: target.renewedAcceptance,
            },
          ];
    }),
  };
}
export type PublicationPreview = SuccessDocumentPublicationPreview["data"] & {
  target: PublicationTarget;
};
export async function previewPublication(target: PublicationTarget) {
  const backend = await scopedBackend(target.scope);
  const result = await backend.call("document_publication_preview_v1", {
    ...publicationRequest(target),
    request_id: uuidv7(),
  });
  z.uuid().parse(result.preview.id);
  z.string().min(1).parse(result.preview.token);
  z.iso.datetime({ offset: true }).parse(result.preview.expires_at);
  if (result.preserves_reservations !== true) throw Error("DOCUMENT_PREVIEW_UNAVAILABLE");
  const subjects = new Set<string>();
  for (const row of result.affected) {
    z.uuid().parse(row.subject.id);
    z.uuid().parse(row.person_id);
    z.uuid().parse(row.center_id);
    z.number().int().positive().parse(row.version);
    const key = `${row.subject.type}:${row.subject.id}`;
    if (!["reservations", "event_registrations"].includes(row.subject.type) || subjects.has(key))
      throw Error("DOCUMENT_PREVIEW_UNAVAILABLE");
    subjects.add(key);
  }
  return { ...result, target: structuredClone(target) };
}
export interface PublicationIntent {
  scope: ClientScope;
  request:
    | Omit<Extract<RequestDocumentVersionPublish, { file_id: string }>, "request_id">
    | Omit<
        Extract<RequestDocumentVersionPublish, { digital_content: DigitalDocumentContent }>,
        "request_id"
      >;
}
export async function publicationIntent(
  target: PublicationTarget,
  before: PublicationPreview,
  reviewed: boolean,
): Promise<PublicationIntent> {
  const request = publicationRequest(target);
  if (
    JSON.stringify(request) !== JSON.stringify(publicationRequest(before.target)) ||
    !reviewed ||
    before.preview.blockers.length ||
    Date.parse(before.preview.expires_at) <= Date.now()
  )
    throw Error("DOCUMENT_REVIEW_REQUIRED");
  const backend = await scopedBackend(target.scope);
  const fresh = await backend.call("preview_get_v1", {
    client_api_version: request.client_api_version,
    org_id: request.org_id,
    center_id: request.center_id,
    request_id: uuidv7(),
    preview_id: before.preview.id,
  });
  if (
    fresh.id !== before.preview.id ||
    fresh.scope_hash !== before.preview.scope_hash ||
    JSON.stringify(fresh.dependencies) !== JSON.stringify(before.preview.dependencies) ||
    fresh.blockers.length ||
    Date.parse(fresh.expires_at) <= Date.now()
  )
    throw Error("DOCUMENT_PREVIEW_STALE");
  return {
    scope: structuredClone(target.scope),
    request: {
      ...request,
      operation_key: uuidv7(),
      impact_approval: {
        preview: { id: before.preview.id, token: before.preview.token },
        accepted_subjects: before.affected.map((r) => structuredClone(r.subject)),
      },
    },
  };
}
export async function writePublication(intent: PublicationIntent) {
  const backend = await scopedBackend(intent.scope);
  return backend.call("document_version_publish_v1", { ...intent.request, request_id: uuidv7() });
}
export async function readPublication(intent: PublicationIntent, id?: string) {
  const backend = await scopedBackend(intent.scope);
  const digital = intent.request.digital_content;
  const fileId = z.uuid().parse(digital ? id : intent.request.file_id);
  if (id && id !== fileId) throw Error("DOCUMENT_RESULT_UNAVAILABLE");
  const result = await backend.call("management_state_get_v1", {
    ...common(intent.scope),
    center_id: intent.request.center_id,
    request_id: uuidv7(),
    operation: "document_version_publish_v1",
    selector: {
      operation: "document_version_publish_v1",
      key: {
        file_id: fileId,
        scope: intent.request.scope,
        ...(intent.request.document_id ? { document_id: intent.request.document_id } : {}),
      },
    },
    page: { limit: 1 },
  });
  const row = result.items.find(
    (r) => r.entity?.type === "document_versions" && r.entity.id === fileId,
  );
  if (
    !row?.exists ||
    row.state !== "published" ||
    row.current?.operation !== "document_version_publish_v1"
  )
    throw Error("DOCUMENT_RESULT_UNAVAILABLE");
  const values = row.current.values;
  const normalize = (requirements: typeof values.requirements) =>
    requirements
      ?.map((r) => ({
        gate: r.gate,
        scope: {
          center_ids: r.scope.center_ids,
          product_version_ids: r.scope.product_version_ids,
          session_ids: r.scope.session_ids,
          event_ids: r.scope.event_ids,
        },
        renewed_acceptance: r.renewed_acceptance,
      }))
      .sort((a, b) => a.gate.localeCompare(b.gate));
  if (
    values.file_id !== fileId ||
    values.version_label !== intent.request.version_label ||
    values.scope?.kind !== intent.request.scope.kind ||
    (intent.request.scope.kind === "center" &&
      values.scope.center_id !== intent.request.scope.center_id) ||
    (intent.request.scope.kind === "organization" && values.scope.center_id != null) ||
    JSON.stringify(normalize(values.requirements)) !==
      JSON.stringify(normalize(intent.request.requirements)) ||
    (intent.request.document_id && values.document_id !== intent.request.document_id)
  )
    throw Error("DOCUMENT_RESULT_UNAVAILABLE");
  const documentId = z.uuid().parse(values.document_id);
  if (digital) {
    const catalog = await readDocumentCatalog(
      intent.scope,
      intent.request.scope.kind === "organization",
      documentId,
    );
    const source = catalog.find(
      (item) => item.id === fileId && item.source_version === fileId && item.state === "published",
    );
    if (!source || !matchesDocumentText(source.content, digital))
      throw Error("DOCUMENT_RESULT_UNAVAILABLE");
  }
  return {
    documentId,
    versionId: fileId,
    versionLabel: values.version_label,
  };
}
export async function documentReceipt(intent: CompleteIntent | PublicationIntent) {
  const operation =
    "checksum" in intent.request ? "file_upload_complete_v1" : "document_version_publish_v1";
  const backend = await scopedBackend(intent.scope);
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation,
    key: intent.request.operation_key,
  });
  if (
    receipt.operation !== operation ||
    receipt.key !== intent.request.operation_key ||
    (receipt.result_reference &&
      receipt.result_reference.type !==
        (operation === "file_upload_complete_v1" ? "files" : "document_versions"))
  )
    throw Error("DOCUMENT_RECEIPT_UNAVAILABLE");
  return receipt;
}
