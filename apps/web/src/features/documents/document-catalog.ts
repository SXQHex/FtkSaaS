import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { DigitalDocumentContent, RequestContentCatalogSave } from "@ftksaas/api-contracts";
import type { ClientScope, AccountReadContext } from "../../lib/scoped-backend";
import { scopedBackend } from "../../lib/scoped-backend";

export function documentCatalogScope(
  scope: ClientScope,
  organization: boolean,
  documentId: string,
) {
  return {
    org_id: scope.orgId,
    center_id: organization ? null : scope.centerId,
    scope_key: organization
      ? `organization:${scope.orgId}`
      : `center:${scope.orgId}:${scope.centerId}`,
    code: `document.${documentId}`,
    channel: "document" as const,
  };
}

export async function readDocumentCatalog(
  scope: ClientScope,
  organization: boolean,
  documentId: string,
  context?: AccountReadContext,
) {
  const source = documentCatalogScope(scope, organization, documentId);
  const result = await (
    await scopedBackend(scope, undefined, context)
  ).call("content_catalog_get_v1", {
    ...source,
    client_api_version: 1,
    request_id: uuidv7(),
  });
  if (
    new Set(result.items.map((row) => row.id)).size !== result.items.length ||
    result.items.some(
      (row) =>
        row.org_id !== source.org_id ||
        row.center_id !== source.center_id ||
        row.scope_key !== source.scope_key ||
        row.code !== source.code ||
        row.channel !== source.channel ||
        typeof row.invalidated !== "boolean",
    )
  )
    throw Error("DOCUMENT_CATALOG_SOURCE_INVALID");
  return result.items;
}

export type DocumentCatalogIntent = {
  scope: ClientScope;
  documentId: string;
  sourceId: string;
  organization: boolean;
  rowId?: string;
  request: Omit<RequestContentCatalogSave, "request_id">;
};

export function catalogIntent(
  scope: ClientScope,
  organization: boolean,
  documentId: string,
  sourceId: string,
  source: { language: string; version: number; rowId?: string; revision?: number },
  action: RequestContentCatalogSave["action"],
  content?: DigitalDocumentContent,
): DocumentCatalogIntent {
  return {
    scope,
    organization,
    documentId,
    sourceId,
    rowId: source.rowId,
    request: {
      ...documentCatalogScope(scope, organization, documentId),
      client_api_version: 1,
      operation_key: uuidv7(),
      action,
      language: source.language,
      version: source.version,
      source_version: sourceId,
      ...(source.revision !== undefined ? { expected_revision: source.revision } : {}),
      ...(content ? { content } : {}),
    },
  };
}

export async function writeCatalogIntent(intent: DocumentCatalogIntent) {
  const backend = await scopedBackend(intent.scope);
  const result = await backend.call("content_catalog_save_v1", {
    ...intent.request,
    request_id: uuidv7(),
  });
  z.uuid().parse(result.primary_id);
  if (intent.rowId && intent.rowId !== result.primary_id)
    throw Error("DOCUMENT_CATALOG_RESULT_INVALID");
  return result;
}

export function matchesDocumentText(value: unknown, expected: DigitalDocumentContent) {
  if (value === null || typeof value !== "object") return false;
  return Object.entries(expected).every(([key, text]) => Reflect.get(value, key) === text);
}

export async function readCatalogResult(intent: DocumentCatalogIntent, id?: string) {
  if (!id || (intent.rowId && id !== intent.rowId)) throw Error("DOCUMENT_CATALOG_RESULT_INVALID");
  const list = await readDocumentCatalog(intent.scope, intent.organization, intent.documentId);
  const { request } = intent;
  const row = list.find(
    (entry) =>
      entry.id === id &&
      entry.source_version === intent.sourceId &&
      entry.language === request.language &&
      entry.version === request.version,
  );
  if (!row) throw Error("DOCUMENT_CATALOG_RESULT_INVALID");
  if (request.action === "retire" && !row.retired) throw Error("DOCUMENT_CATALOG_RESULT_INVALID");
  if (request.action === "invalidate" && !row.invalidated)
    throw Error("DOCUMENT_CATALOG_RESULT_INVALID");
  if (
    (request.action === "draft" || request.action === "publish") &&
    (row.state !== (request.action === "draft" ? "draft" : "published") ||
      !request.content ||
      !("name" in request.content) ||
      !matchesDocumentText(row.content, request.content) ||
      (request.expected_revision !== undefined && row.revision <= request.expected_revision))
  )
    throw Error("DOCUMENT_CATALOG_RESULT_INVALID");
  return list;
}
