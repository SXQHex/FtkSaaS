import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { AcceptanceContext } from "../../lib/api-contracts/generated";
export function documentContextKey(context: AcceptanceContext) {
  return JSON.stringify([
    context.gate,
    context.subject.type,
    context.subject.id,
    context.product_version_id ?? null,
    context.purchase_preview_id ?? null,
    context.event_registration_preview_id ?? null,
  ]);
}
export async function readMemberDocumentContexts(scope: ClientScope, cursor?: string) {
  const backend = await scopedBackend(scope);
  const page = await backend.call("member_document_contexts_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    page: { limit: 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  if (page.items.length > 20 || (cursor && page.next_cursor === cursor))
    throw Error("MEMBER_DOCUMENT_CONTEXTS_UNAVAILABLE");
  z.iso.datetime({ offset: true }).parse(page.as_of);
  const contexts = new Set<string>();
  for (const row of page.items) {
    const context = row.context;
    z.enum(["sale", "reservation", "attendance", "event_registration"]).parse(context.gate);
    z.enum([
      "sales",
      "product_versions",
      "sessions",
      "reservations",
      "private_lesson_requests",
      "events",
      "event_registrations",
    ]).parse(context.subject.type);
    z.uuid().parse(context.subject.id);
    if (context.product_version_id) z.uuid().parse(context.product_version_id);
    if (context.purchase_preview_id) z.uuid().parse(context.purchase_preview_id);
    if (context.event_registration_preview_id) {
      z.uuid().parse(context.event_registration_preview_id);
      if (
        context.gate !== "event_registration" ||
        context.subject.type !== "events" ||
        context.purchase_preview_id
      )
        throw Error("MEMBER_DOCUMENT_CONTEXTS_UNAVAILABLE");
    }
    const key = documentContextKey(context);
    if (context.on_behalf_of_person_id || contexts.has(key) || !row.requirements.length)
      throw Error("MEMBER_DOCUMENT_CONTEXTS_UNAVAILABLE");
    contexts.add(key);
    const ids = new Set<string>();
    for (const doc of row.requirements) {
      z.uuid().parse(doc.id);
      z.uuid().parse(doc.version_id);
      z.uuid().parse(doc.file.id);
      z.string().trim().min(1).parse(doc.name);
      z.boolean().parse(doc.accepted);
      if (doc.file.type !== "files" || doc.required_at !== context.gate || ids.has(doc.id))
        throw Error("MEMBER_DOCUMENT_CONTEXTS_UNAVAILABLE");
      ids.add(doc.id);
    }
  }
  return page;
}
