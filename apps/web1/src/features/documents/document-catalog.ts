import { v7 as uuidv7 } from "uuid";
import type { ClientScope } from "../../lib/scoped-backend";
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
) {
  const source = documentCatalogScope(scope, organization, documentId);
  const result = await (
    await scopedBackend(scope)
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
        row.channel !== source.channel,
    )
  )
    throw Error("DOCUMENT_CATALOG_SOURCE_INVALID");
  return result.items;
}
