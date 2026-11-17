import { beforeEach, expect, it, vi } from "vitest";
import { readMemberDocumentContexts, documentContextKey } from "./member-document-contexts";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const context = {
  gate: "sale" as const,
  subject: { type: "product_versions" as const, id: id(4) },
  product_version_id: id(4),
  purchase_preview_id: id(5),
};
const doc = {
  id: id(6),
  version_id: id(7),
  name: "Sentetik koşullar",
  content_hash: "synthetic",
  required_at: "sale",
  accepted: false,
  file: { type: "files", id: id(8) },
};
const page = () => ({
  items: [{ context, requirements: [doc] }],
  next_cursor: "second",
  as_of: "2026-11-17T12:00:00Z",
});
beforeEach(() => call.mockReset());
it("discovers only native self contexts without inventing person or content selectors", async () => {
  call.mockResolvedValue(page());
  const result = await readMemberDocumentContexts(scope);
  expect(result.items[0]?.context).toEqual(context);
  expect(call).toHaveBeenCalledExactlyOnceWith(
    "member_document_contexts_get_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      page: { limit: 20, sort: "created_at_asc" },
    }),
  );
  expect(call.mock.calls[0]![1]).not.toHaveProperty("person_id");
  expect(call.mock.calls[0]![1]).not.toHaveProperty("context");
});
it("keeps the same document in separate purchases and preserves original preview binding", async () => {
  const other = { ...context, purchase_preview_id: id(9) };
  call.mockResolvedValue({
    ...page(),
    items: [...page().items, { context: other, requirements: [doc] }],
  });
  expect((await readMemberDocumentContexts(scope)).items).toHaveLength(2);
  expect(documentContextKey(context)).not.toBe(documentContextKey(other));
});
it("rejects generic people, on-behalf acceptance, mismatched gates and duplicate contexts", async () => {
  for (const item of [
    { context: { ...context, subject: { type: "people", id: id(4) } }, requirements: [doc] },
    { context: { ...context, on_behalf_of_person_id: id(9) }, requirements: [doc] },
    { context, requirements: [{ ...doc, required_at: "reservation" }] },
    { context, requirements: [] },
  ]) {
    call.mockResolvedValue({ ...page(), items: [item] });
    await expect(readMemberDocumentContexts(scope)).rejects.toThrow();
  }
  call.mockResolvedValue({ ...page(), items: [...page().items, ...page().items] });
  await expect(readMemberDocumentContexts(scope)).rejects.toThrow();
});
it("pins pagination to native cursor and rejects a repeated cursor", async () => {
  call.mockResolvedValue({ ...page(), next_cursor: null });
  await readMemberDocumentContexts(scope, "prior");
  expect(call.mock.calls[0]![1].page.cursor).toBe("prior");
  call.mockResolvedValue({ ...page(), next_cursor: "prior" });
  await expect(readMemberDocumentContexts(scope, "prior")).rejects.toThrow();
});
