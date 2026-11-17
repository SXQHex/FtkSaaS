import { beforeEach, expect, it, vi } from "vitest";
import { readDocumentDirectory } from "./document-directory";
import { previewPublication } from "./document-publication";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const summary = {
  published_documents: 4,
  unpublished_files: 2,
  pending_members: 3,
  total_members: 8,
  last_publication: null,
  acceptance_records: 19,
};
const version = {
  version_id: id(5),
  version: 2,
  version_label: "v2",
  published_at: "2026-11-10T12:00:00Z",
  effective_at: "2026-11-10T12:00:00Z",
  requirements: [],
};
const doc = {
  key: id(4),
  kind: "document",
  document_id: id(4),
  file_id: null,
  name: "Sentetik belge",
  created_at: "2026-11-01T12:00:00Z",
  expires_at: null,
  state: "published",
  scope: "center",
  read_only: false,
  latest_version: version,
  version_count: 2,
  required_members: 8,
  pending_members: 3,
  acceptance_records: 19,
};
const response = (view: string, items: unknown[]) => ({
  view,
  items,
  summary,
  as_of: "2026-11-17T12:00:00Z",
  next_cursor: null,
  history_available: true,
});
beforeEach(() => call.mockReset());
it("keeps native pre-cursor counts and explicitly binds scope, search and cursor", async () => {
  call.mockResolvedValue(response("documents", [doc]));
  const data = await readDocumentDirectory(scope, {
    view: "documents",
    level: "organization",
    query: "  Metin  ",
    cursor: "native-cursor",
  });
  expect(data.summary).toEqual(summary);
  expect(call.mock.calls[0]![1]).toMatchObject({
    org_id: scope.orgId,
    center_id: scope.centerId,
    scope: "organization",
    query: "Metin",
    page: { limit: 20, cursor: "native-cursor" },
  });
  expect(data.items).toHaveLength(1);
});
it("does not relabel an older evidence version that the native requirement still accepts", async () => {
  const row = {
    key: "requirement",
    kind: "requirement",
    person_id: id(6),
    display_name: "Sentetik kişi",
    context: { gate: "sale", subject: { type: "sales", id: id(7) } },
    document_id: id(4),
    required_version_id: id(5),
    accepted: true,
    status: "valid",
    evidence_id: id(8),
    evidence_version_id: id(9),
    evidence_at: "2026-11-01T12:00:00Z",
    evidence_matches_version: false,
  };
  call.mockResolvedValue(response("acceptances", [row]));
  expect(
    (await readDocumentDirectory(scope, { view: "acceptances", documentId: id(4), filter: "all" }))
      .items[0],
  ).toMatchObject({ accepted: true, status: "valid", evidence_matches_version: false });
  await expect(
    readDocumentDirectory(scope, { view: "acceptances", documentId: id(4), filter: "pending" }),
  ).rejects.toThrow();
});
it("preserves permission-hidden organization metadata as null and rejects false counts", async () => {
  call.mockResolvedValue(
    response("documents", [
      {
        ...doc,
        scope: "organization",
        read_only: true,
        latest_version: { ...version, requirements: null },
        version_count: null,
        acceptance_records: null,
      },
    ]),
  );
  expect((await readDocumentDirectory(scope, { view: "documents" })).items[0]).toMatchObject({
    read_only: true,
    version_count: null,
    acceptance_records: null,
  });
  call.mockResolvedValue({
    ...response("documents", [doc]),
    summary: { ...summary, pending_members: 9 },
  });
  await expect(readDocumentDirectory(scope, { view: "documents" })).rejects.toThrow();
});
it("requires an actual document and separates history from current pending requirements", async () => {
  await expect(readDocumentDirectory(scope, { view: "acceptances" })).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
  const history = {
    key: "history",
    kind: "history",
    person_id: id(6),
    display_name: "Sentetik kişi",
    context: { gate: "sale", subject: { type: "sales", id: id(7) } },
    document_id: id(4),
    acceptance_id: id(8),
    version_id: id(5),
    version_label: "v2",
    accepted_at: "2026-11-01T12:00:00Z",
    evidence_state: "recorded",
    evidence_kind: "server_document",
  };
  call.mockResolvedValue({ ...response("acceptances", [history]), history_available: false });
  await expect(
    readDocumentDirectory(scope, { view: "acceptances", documentId: id(4) }),
  ).rejects.toThrow();
});
it("rejects cross-document evidence, duplicate rows and a repeating cursor", async () => {
  call.mockResolvedValue(response("documents", [doc, doc]));
  await expect(readDocumentDirectory(scope, { view: "documents" })).rejects.toThrow();
  call.mockResolvedValue({ ...response("documents", [doc]), next_cursor: "same" });
  await expect(
    readDocumentDirectory(scope, { view: "documents", cursor: "same" }),
  ).rejects.toThrow();
  call.mockResolvedValue(response("documents", [doc]));
  await expect(
    readDocumentDirectory(scope, { view: "documents", documentId: id(11) }),
  ).rejects.toThrow();
});
it("new versions preserve exact old gate scopes and apply newly added gates only to the selected center", async () => {
  call.mockResolvedValue({
    preview: { id: id(15), token: "synthetic", expires_at: "2099-01-01T00:00:00Z" },
    affected: [],
    preserves_reservations: true,
  });
  await previewPublication({
    scope,
    fileId: id(10),
    documentId: id(4),
    versionLabel: "v3",
    gates: ["sale", "reservation"],
    renewedAcceptance: false,
    level: "organization",
    baseRequirements: [
      {
        gate: "sale",
        scope: { product_version_ids: [id(11)], center_ids: [id(12)] },
        renewed_acceptance: true,
      },
    ],
  });
  const request = call.mock.calls[0]![1];
  expect(request.scope).toEqual({ kind: "organization" });
  expect(request.center_id).toBeNull();
  expect(request.requirements).toEqual([
    {
      gate: "sale",
      scope: { product_version_ids: [id(11)], center_ids: [id(12)] },
      renewed_acceptance: false,
    },
    { gate: "reservation", scope: { center_ids: [scope.centerId] }, renewed_acceptance: false },
  ]);
});
