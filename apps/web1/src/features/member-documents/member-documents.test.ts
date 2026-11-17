import { beforeEach, expect, it, vi } from "vitest";
import type { DocumentView } from "../../lib/api-contracts/generated";
import {
  documentBody,
  readRequiredDocuments,
  documentAcceptanceIntent,
  writeDocumentAcceptance,
  readDocumentReceipt,
  readDocumentResult,
} from "./member-documents";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const binding = {
  scope: { accountId: id(1), orgId: id(2), centerId: id(3) },
  personId: id(4),
  context: {
    gate: "reservation" as const,
    subject: { type: "sessions" as const, id: id(5) },
    product_version_id: id(6),
  },
};
const doc: DocumentView = {
  id: id(7),
  version_id: id(8),
  file: { type: "files", id: id(9) },
  name: "Koşullar",
  required_at: "reservation",
  accepted: false,
  content_hash: "rendered-hash",
  content_kind: "digital",
  rendered_document: {
    id: id(10),
    language: "tr",
    source_version: id(8),
    content_hash: "rendered-hash",
    source_content_hash: "source-hash",
    content: {
      name: "Koşullar",
      language: "tr",
      template_id: "document.test",
      template_version: "1",
      text: "Okunacak gerçek metin <script>çalışmaz</script>",
    },
    created_at: "2026-11-17T12:00:00Z",
  },
};
beforeEach(() => call.mockReset());
it("binds native self, center, session, actual product version and selected content file", async () => {
  call.mockResolvedValueOnce([doc]);
  expect(await readRequiredDocuments(binding, doc.file.id)).toEqual([doc]);
  expect(call).toHaveBeenCalledWith(
    "document_requirements_get_v1",
    expect.objectContaining({
      person_id: binding.personId,
      org_id: binding.scope.orgId,
      center_id: binding.scope.centerId,
      context: binding.context,
      content_file_id: doc.file.id,
    }),
  );
  await expect(
    readRequiredDocuments({
      ...binding,
      context: { ...binding.context, on_behalf_of_person_id: id(99) },
    }),
  ).rejects.toThrow("DOCUMENT_SELF_REQUIRED");
});
it("rejects duplicate, wrong-gate, malformed and non-file requirements", async () => {
  for (const rows of [
    [doc, doc],
    [{ ...doc, required_at: "sale" }],
    [{ ...doc, version_id: "invalid" }],
    [{ ...doc, file: { type: "people", id: id(9) } }],
  ]) {
    call.mockResolvedValueOnce(rows);
    await expect(readRequiredDocuments(binding)).rejects.toThrow();
  }
});
it("reads stored digital content and refuses missing or mismatched rendering", () => {
  expect(documentBody(doc)).toEqual({ text: doc.rendered_document!.content.text, language: "tr" });
  for (const row of [
    { ...doc, rendered_document: undefined },
    { ...doc, content_hash: "changed" },
    { ...doc, rendered_document: { ...doc.rendered_document!, source_version: id(99) } },
  ])
    expect(() => documentBody(row)).toThrow("DOCUMENT_RENDER_UNAVAILABLE");
});
it("decodes UTF8 plain text and PDF bytes without external document URLs", () => {
  const content = {
    encoding: "base64" as const,
    mime: "text/plain" as const,
    data: btoa(String.fromCharCode(...new TextEncoder().encode("Türkçe koşullar"))),
  };
  expect(documentBody({ ...doc, content_kind: "file", content })).toEqual({
    text: "Türkçe koşullar",
  });
  const pdf = documentBody({
    ...doc,
    content_kind: "file",
    content: { ...content, mime: "application/pdf", data: btoa("%PDF-1.7") },
  });
  expect("pdf" in pdf).toBe(true);
  if ("pdf" in pdf)
    expect(Array.from(pdf.pdf)).toEqual(Array.from(new TextEncoder().encode("%PDF-1.7")));
  expect(() =>
    documentBody({ ...doc, content_kind: "file", content: { ...content, data: btoa("\xff") } }),
  ).toThrow();
});
it("requires explicit review and never constructs a write for already accepted documents", async () => {
  await expect(documentAcceptanceIntent(binding, doc, false)).rejects.toThrow(
    "DOCUMENT_REVIEW_REQUIRED",
  );
  await expect(
    documentAcceptanceIntent(binding, { ...doc, accepted: true }, true),
  ).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
});
it("rejects changed source version, hash or presentation before a write", async () => {
  for (const fresh of [
    { ...doc, version_id: id(99) },
    { ...doc, content_hash: "changed" },
    { ...doc, rendered_document: { ...doc.rendered_document!, id: id(99) } },
  ]) {
    call.mockResolvedValueOnce([fresh]);
    await expect(documentAcceptanceIntent(binding, doc, true)).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
  }
});
it("sends only server presentation ID and stable operation key, never client legal text", async () => {
  call.mockResolvedValueOnce([doc]);
  const intent = await documentAcceptanceIntent(binding, doc, true);
  call.mockResolvedValue({ primary_id: id(11) });
  await writeDocumentAcceptance(intent);
  await writeDocumentAcceptance(intent);
  const writes = call.mock.calls.filter(([op]) => op === "document_accept_v1");
  expect(writes).toHaveLength(2);
  expect(writes[0]![1]).toEqual({ ...intent.request, request_id: expect.any(String) });
  expect(writes[1]![1].operation_key).toBe(writes[0]![1].operation_key);
  expect(intent.request).toHaveProperty("rendered_document_id", id(10));
  for (const key of [
    "document_version_id",
    "displayed_content",
    "displayed_content_hash",
    "person_id",
  ])
    expect(intent.request).not.toHaveProperty(key);
});
it("preserves legacy file version acceptance", async () => {
  const file = {
    ...doc,
    content_kind: "file" as const,
    rendered_document: undefined,
    content: {
      encoding: "base64" as const,
      mime: "text/plain" as const,
      data: btoa("Legacy terms"),
    },
  };
  call.mockResolvedValueOnce([file]);
  const intent = await documentAcceptanceIntent(binding, file, true);
  expect(intent.request).toHaveProperty("document_version_id", doc.version_id);
  expect(intent.request).not.toHaveProperty("rendered_document_id");
  call.mockResolvedValueOnce([{ ...file, accepted: true }]);
  expect(await readDocumentResult(intent, id(11))).toHaveLength(1);
});
it("rejects foreign receipt operation, key and result entity", async () => {
  call.mockResolvedValueOnce([doc]);
  const intent = await documentAcceptanceIntent(binding, doc, true);
  for (const receipt of [
    { operation: "reservation_create_v1", key: intent.request.operation_key },
    { operation: "document_accept_v1", key: id(99) },
    {
      operation: "document_accept_v1",
      key: intent.request.operation_key,
      result_reference: { type: "reservations", id: id(11) },
    },
  ]) {
    call.mockResolvedValueOnce(receipt);
    await expect(readDocumentReceipt(intent)).rejects.toThrow("DOCUMENT_RECEIPT_UNAVAILABLE");
  }
});
it("confirms accepted server evidence against the exact actor, person, rendering and ACK ID", async () => {
  call.mockResolvedValueOnce([doc]);
  const intent = await documentAcceptanceIntent(binding, doc, true);
  const accepted = {
    ...doc,
    accepted: true,
    digital_acceptance: {
      id: id(11),
      account_id: binding.scope.accountId,
      person_id: binding.personId,
      accepted_at: "2026-11-17T12:01:00Z",
      content_hash: doc.content_hash,
      source_content_hash: "source-hash",
      displayed_content: doc.rendered_document!.content,
      rendered_document_id: id(10),
      evidence_kind: "server_document" as const,
    },
  };
  call.mockResolvedValueOnce([accepted]);
  expect(await readDocumentResult(intent, id(11))).toHaveLength(1);
  for (const evidence of [
    { ...accepted.digital_acceptance, id: id(99) },
    { ...accepted.digital_acceptance, person_id: id(99) },
    { ...accepted.digital_acceptance, account_id: id(99) },
    { ...accepted.digital_acceptance, rendered_document_id: id(99) },
    { ...accepted.digital_acceptance, evidence_kind: "legacy_client" },
  ]) {
    call.mockResolvedValueOnce([{ ...accepted, digital_acceptance: evidence }]);
    await expect(readDocumentResult(intent, id(11))).rejects.toThrow("DOCUMENT_RESULT_UNAVAILABLE");
  }
});
