import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  DocumentDirectoryDocument,
  DocumentDirectoryPage,
  DocumentDirectoryVersion,
} from "../../lib/api-contracts/generated";
const instant = z.iso.datetime({ offset: true }),
  count = z.number().int().nonnegative().safe();
const version = z.object({
  version_id: z.uuid(),
  version: z.number().int().positive().safe().nullable(),
  version_label: z.string(),
  published_at: instant,
  effective_at: instant,
  requirements: z
    .array(
      z.object({
        gate: z.enum(["sale", "reservation", "attendance", "event_registration"]),
        scope: z.object({
          center_ids: z.array(z.uuid()).optional(),
          product_version_ids: z.array(z.uuid()).optional(),
          session_ids: z.array(z.uuid()).optional(),
          event_ids: z.array(z.uuid()).optional(),
        }),
        renewed_acceptance: z.boolean(),
      }),
    )
    .nullable(),
});
export type DocumentDirectoryInput = {
  view: "documents" | "versions" | "acceptances";
  level?: "center" | "organization";
  documentId?: string;
  versionId?: string;
  filter?: "pending" | "all";
  query?: string;
  cursor?: string;
};
export async function readDocumentDirectory(
  scope: ClientScope,
  input: DocumentDirectoryInput,
): Promise<DocumentDirectoryPage> {
  if (input.documentId) z.uuid().parse(input.documentId);
  if (input.versionId) z.uuid().parse(input.versionId);
  if (
    (input.view !== "documents" && !input.documentId) ||
    (input.view === "documents" && input.versionId) ||
    (input.view === "versions" && input.filter === "pending")
  )
    throw Error("DOCUMENT_DIRECTORY_SCOPE_INVALID");
  const query = input.query?.trim();
  if (query) z.string().max(200).parse(query);
  const data = await (
    await scopedBackend(scope)
  ).call("document_directory_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    view: input.view,
    scope: input.level ?? "center",
    ...(input.documentId ? { document_id: input.documentId } : {}),
    ...(input.versionId ? { version_id: input.versionId } : {}),
    ...(input.view !== "versions" ? { acceptance_filter: input.filter ?? "all" } : {}),
    ...(query && input.view !== "versions" ? { query } : {}),
    page: { limit: 20, ...(input.cursor ? { cursor: input.cursor } : {}) },
  });
  if (
    data.view !== input.view ||
    data.items.length > 20 ||
    (input.cursor && data.next_cursor === input.cursor)
  )
    throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
  instant.parse(data.as_of);
  z.boolean().parse(data.history_available);
  for (const key of [
    "published_documents",
    "unpublished_files",
    "pending_members",
    "total_members",
    "acceptance_records",
  ] as const)
    count.parse(data.summary[key]);
  if (data.summary.pending_members > data.summary.total_members)
    throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
  if (data.summary.last_publication) instant.parse(data.summary.last_publication);
  const ids = new Set<string>();
  for (const row of data.items) {
    const key = "key" in row ? row.key : row.version_id;
    if (ids.has(key)) throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
    ids.add(z.string().min(1).parse(key));
    if (input.view === "versions") {
      if ("kind" in row) throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
      version.parse(row);
      if (input.versionId && row.version_id !== input.versionId)
        throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
      continue;
    }
    if (!("kind" in row)) throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
    if (input.view === "documents") {
      if (row.kind !== "document" && row.kind !== "unpublished_file")
        throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
      instant.parse(row.created_at);
      if (row.expires_at) instant.parse(row.expires_at);
      z.boolean().parse(row.read_only);
      count.parse(row.required_members);
      count.parse(row.pending_members);
      if (
        row.pending_members > row.required_members ||
        !["center", "organization"].includes(row.scope)
      )
        throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
      if (row.version_count !== null) count.parse(row.version_count);
      if (row.acceptance_records !== null) count.parse(row.acceptance_records);
      if (row.kind === "document") {
        z.uuid().parse(row.document_id);
        if (!row.latest_version) throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
        version.parse(row.latest_version);
        if (input.documentId && row.document_id !== input.documentId)
          throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
      } else {
        z.uuid().parse(row.file_id);
        if (row.document_id !== null || row.latest_version !== null)
          throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
      }
    } else {
      if (
        (row.kind !== "requirement" && row.kind !== "history") ||
        row.document_id !== input.documentId
      )
        throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
      z.uuid().parse(row.person_id);
      z.string().parse(row.display_name);
      z.enum(["sale", "reservation", "attendance", "event_registration"]).parse(row.context.gate);
      z.uuid().parse(row.context.subject.id);
      if (row.kind === "history") {
        if (input.filter === "pending" || !data.history_available)
          throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
        z.uuid().parse(row.acceptance_id);
        z.uuid().parse(row.version_id);
        instant.parse(row.accepted_at);
        z.enum(["recorded", "invalidated"]).parse(row.evidence_state);
        if (input.versionId && row.version_id !== input.versionId)
          throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
      } else {
        z.uuid().parse(row.required_version_id);
        z.enum(["valid", "outdated", "missing"]).parse(row.status);
        if (
          row.accepted !== (row.status === "valid") ||
          (input.filter === "pending" && row.accepted) ||
          (input.versionId && row.required_version_id !== input.versionId)
        )
          throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
        for (const id of [row.evidence_id, row.evidence_version_id])
          if (id !== null) z.uuid().parse(id);
        if (row.evidence_at) instant.parse(row.evidence_at);
        if (row.evidence_matches_version !== null) z.boolean().parse(row.evidence_matches_version);
      }
    }
  }
  return data;
}
export function directoryDocuments(data: DocumentDirectoryPage) {
  return data.items.filter(
    (row): row is DocumentDirectoryDocument =>
      "kind" in row && (row.kind === "document" || row.kind === "unpublished_file"),
  );
}
export function directoryVersions(data: DocumentDirectoryPage) {
  return data.items.filter((row): row is DocumentDirectoryVersion => !("kind" in row));
}
