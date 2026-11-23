import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type {
  AcceptanceContext,
  DocumentView,
  RequestDocumentAccept,
} from "@ftksaas/api-contracts";

export interface DocumentContext {
  scope: ClientScope;
  personId: string;
  context: AcceptanceContext;
}
export async function readRequiredDocuments(
  binding: DocumentContext,
  fileId?: string,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend(binding.scope, undefined, readContext);
  if (binding.context.on_behalf_of_person_id) throw Error("DOCUMENT_SELF_REQUIRED");
  const rows = await backend.call("document_requirements_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: binding.scope.orgId,
    center_id: binding.scope.centerId,
    person_id: z.uuid().parse(binding.personId),
    context: binding.context,
    ...(fileId ? { content_file_id: z.uuid().parse(fileId) } : {}),
  });
  const seen = new Set<string>();
  for (const row of rows) {
    z.uuid().parse(row.id);
    z.uuid().parse(row.version_id);
    z.uuid().parse(row.file.id);
    if (seen.has(row.id) || row.file.type !== "files" || row.required_at !== binding.context.gate)
      throw Error("DOCUMENT_REQUIREMENTS_UNAVAILABLE");
    z.boolean().parse(row.accepted);
    z.string().min(1).parse(row.name);
    seen.add(row.id);
  }
  return rows;
}
export function documentBody(
  row: DocumentView,
): { text: string; language?: string } | { pdf: Uint8Array<ArrayBuffer> } {
  if (row.content_kind === "digital") {
    const rendered = row.rendered_document;
    if (
      !rendered ||
      rendered.content_hash !== row.content_hash ||
      rendered.source_version !== row.version_id
    )
      throw Error("DOCUMENT_RENDER_UNAVAILABLE");
    z.uuid().parse(rendered.id);
    return {
      text: z.string().min(1).parse(rendered.content.text),
      language: rendered.content.language,
    };
  }
  if (!row.content || row.content.encoding !== "base64")
    throw Error("DOCUMENT_CONTENT_UNAVAILABLE");
  const bytes = Uint8Array.from(atob(row.content.data), (c) => c.charCodeAt(0));
  if (row.content.mime === "application/pdf") return { pdf: bytes };
  if (row.content.mime !== "text/plain") throw Error("DOCUMENT_CONTENT_UNAVAILABLE");
  return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
}
type WithoutRequestId<T> = T extends unknown ? Omit<T, "request_id"> : never;
export interface DocumentAcceptanceIntent {
  binding: DocumentContext;
  document: DocumentView;
  request: WithoutRequestId<RequestDocumentAccept>;
}
export async function documentAcceptanceIntent(
  binding: DocumentContext,
  before: DocumentView,
  reviewed: boolean,
): Promise<DocumentAcceptanceIntent> {
  if (!reviewed || before.accepted) throw Error("DOCUMENT_REVIEW_REQUIRED");
  documentBody(before);
  const fresh = (await readRequiredDocuments(binding, before.file.id)).find(
    (r) => r.id === before.id,
  );
  if (
    !fresh ||
    fresh.accepted ||
    fresh.version_id !== before.version_id ||
    fresh.file.id !== before.file.id ||
    fresh.content_hash !== before.content_hash ||
    fresh.rendered_document?.id !== before.rendered_document?.id
  )
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  const request = {
    client_api_version: 1 as const,
    org_id: binding.scope.orgId,
    center_id: binding.scope.centerId,
    operation_key: uuidv7(),
    context: structuredClone(binding.context),
    ...(before.content_kind === "digital"
      ? { rendered_document_id: before.rendered_document!.id }
      : { document_version_id: before.version_id }),
  };
  return { binding: structuredClone(binding), document: structuredClone(before), request };
}
export async function writeDocumentAcceptance(intent: DocumentAcceptanceIntent) {
  const backend = await scopedBackend(intent.binding.scope);
  const result = await backend.call("document_accept_v1", {
    ...intent.request,
    request_id: uuidv7(),
  });
  z.uuid().parse(result.primary_id);
  return result;
}
export async function readDocumentReceipt(intent: DocumentAcceptanceIntent) {
  const backend = await scopedBackend(intent.binding.scope);
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.binding.scope.orgId,
    operation: "document_accept_v1",
    key: intent.request.operation_key,
  });
  if (
    receipt.operation !== "document_accept_v1" ||
    receipt.key !== intent.request.operation_key ||
    (receipt.result_reference && receipt.result_reference.type !== "document_acceptances")
  )
    throw Error("DOCUMENT_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readDocumentResult(intent: DocumentAcceptanceIntent, id?: string) {
  const rows = await readRequiredDocuments(intent.binding, intent.document.file.id);
  const row = rows.find(
    (r) => r.id === intent.document.id && r.version_id === intent.document.version_id,
  );
  if (!row?.accepted) throw Error("DOCUMENT_RESULT_UNAVAILABLE");
  if (intent.document.content_kind === "digital") {
    const evidence = row.digital_acceptance;
    if (
      !evidence ||
      (id && evidence.id !== id) ||
      evidence.account_id !== intent.binding.scope.accountId ||
      evidence.person_id !== intent.binding.personId ||
      evidence.rendered_document_id !== intent.request.rendered_document_id ||
      evidence.content_hash !== intent.document.content_hash ||
      evidence.evidence_kind !== "server_document"
    )
      throw Error("DOCUMENT_RESULT_UNAVAILABLE");
  }
  return rows;
}
