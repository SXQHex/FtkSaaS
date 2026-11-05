import type { DocumentView, Operations } from "@ftksaas/api-contracts";
import { documentFileHash } from "./documents";
import { setupCall, type SetupScope } from "./studio-setup";
export type DocumentQuery = Omit<
  Operations["document_requirements_get_v1"]["request"],
  "client_api_version" | "request_id"
>;
export async function readContextDocuments(query: DocumentQuery) {
  const rows = await setupCall("document_requirements_get_v1", query);
  if (rows.some((row) => row.required_at !== query.context.gate || row.file.type !== "files"))
    throw Error("documentChanged");
  return rows;
}
export async function readPrivateDocument(query: DocumentQuery, expected: DocumentView) {
  const rows = await readContextDocuments({ ...query, content_file_id: expected.file.id });
  const current = rows.find(
    (row) =>
      row.id === expected.id &&
      row.version_id === expected.version_id &&
      row.file.id === expected.file.id &&
      row.content_hash === expected.content_hash,
  );
  if (!current) throw Error("documentChanged");
  const content = current.content;
  if (
    !content ||
    content.encoding !== "base64" ||
    !["text/plain", "application/pdf"].includes(content.mime) ||
    content.data.length > 2796204 ||
    content.data.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(content.data)
  )
    throw Error("invalidDocumentContent");
  try {
    const binary = atob(content.data);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const file = new File(
      [bytes],
      content.mime === "application/pdf" ? "document.pdf" : "document.txt",
      { type: content.mime },
    );
    if ((await documentFileHash(file)) !== expected.content_hash)
      throw Error("invalidDocumentContent");
    return file;
  } catch {
    throw Error("invalidDocumentContent");
  }
}
export function listSessionDocumentContexts(scope: SetupScope, sessionId: string, cursor?: string) {
  return setupCall("reservation_list_v1", {
    org_id: scope.orgId,
    ...(scope.centerId ? { center_id: scope.centerId } : {}),
    session_id: sessionId,
    page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
}
export const documentReadActions = {
  read: readContextDocuments,
  file: readPrivateDocument,
  person: async (query: DocumentQuery) => {
    if (!query.person_id) throw Error("documentChanged");
    return setupCall("person_get_v1", {
      org_id: query.org_id,
      person_id: query.person_id,
      ...(query.center_id ? { center_id: query.center_id } : {}),
    });
  },
};
export type DocumentReadActions = typeof documentReadActions;
