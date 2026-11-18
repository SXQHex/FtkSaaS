import { beforeEach, expect, it, vi } from "vitest";
import {
  uploadIntent,
  prepareUpload,
  uploadUrl,
  transferUpload,
  completeIntent,
  readComplete,
  previewPublication,
  publicationIntent,
  writePublication,
  readPublication,
  documentReceipt,
  type PublicationIntent,
} from "./document-publication";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const target = {
  scope,
  fileId: id(4),
  versionLabel: "v1",
  gates: ["sale" as const],
  renewedAcceptance: true,
};
const capability = () => ({
  file_id: id(4),
  upload_url: `/storage/v1/object/upload/sign/ftksaas-documents/${scope.orgId}/${id(4)}?token=synthetic`,
  expires_at: new Date(Date.now() + 60000).toISOString(),
  allowed_mime: ["text/plain"],
  max_bytes: 2097152,
});
const preview = () => ({
  id: id(5),
  token: "synthetic",
  scope_hash: "synthetic-hash",
  expires_at: new Date(Date.now() + 60000).toISOString(),
  dependencies: { versions: [] },
  blockers: [],
  effects: [],
});
async function upload() {
  const bytes = new TextEncoder().encode("Sentetik belge");
  const file = new File([bytes], "fixture.txt", { type: "text/plain" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  return uploadIntent(scope, "Sentetik belge", file);
}
beforeEach(() => {
  call.mockReset();
  vi.unstubAllGlobals();
});
it("freezes actual bytes/checksum/name and replays prepare with the same operation key", async () => {
  const intent = await upload();
  call.mockResolvedValue(capability());
  await prepareUpload(intent);
  await prepareUpload(intent);
  expect(intent.checksum).toMatch(/^[a-f0-9]{64}$/);
  expect(call.mock.calls[0]![1].operation_key).toBe(call.mock.calls[1]![1].operation_key);
  expect(call.mock.calls[0]![1].bytes).toBe(intent.body.length);
  expect(call.mock.calls[0]![1].request_id).not.toBe(call.mock.calls[1]![1].request_id);
});
it("rejects empty, oversized and unsupported files before prepare", async () => {
  for (const file of [
    new File([], "empty.txt", { type: "text/plain" }),
    new File([new Uint8Array(2097153)], "large.pdf", { type: "application/pdf" }),
    new File(["x"], "unsafe.html", { type: "text/html" }),
  ])
    await expect(uploadIntent(scope, "Title", file)).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
});
it("pins the upload capability to the configured storage origin, bucket and exact file", () => {
  const ref = capability();
  expect(uploadUrl(scope, ref, "https://project.example.invalid").origin).toBe(
    "https://project.example.invalid",
  );
  for (const url of [
    "https://foreign.example.invalid/path?token=x",
    ref.upload_url.replace(id(4), id(9)),
    ref.upload_url.replace("?token=synthetic", ""),
    ref.upload_url + "#fragment",
  ])
    expect(() =>
      uploadUrl(scope, { ...ref, upload_url: url }, "https://project.example.invalid"),
    ).toThrow("DOCUMENT_UPLOAD_UNAVAILABLE");
});
it("transfers bytes without cookies/redirects and never treats a duplicate as verified ready", async () => {
  const intent = await upload(),
    fetcher = vi.fn().mockResolvedValue({ ok: false, status: 409 });
  vi.stubGlobal("fetch", fetcher);
  await transferUpload(intent, capability());
  expect(fetcher.mock.calls[0]![1]).toMatchObject({
    method: "PUT",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    body: intent.body,
  });
  expect(call).not.toHaveBeenCalledWith("file_upload_complete_v1", expect.anything());
});
it("requires exact ready file/checksum and rejects wrong ACK identity", async () => {
  const intent = completeIntent(await upload(), capability());
  call.mockResolvedValue({
    items: [
      {
        entity: { type: "files", id: id(4) },
        exists: true,
        state: "ready",
        current: {
          operation: "file_upload_complete_v1",
          values: { file_id: id(4), checksum: intent.request.checksum },
        },
      },
    ],
  });
  expect(await readComplete(intent, id(4))).toBe(id(4));
  await expect(readComplete(intent, id(9))).rejects.toThrow();
  call.mockResolvedValue({
    items: [{ entity: { type: "files", id: id(4) }, exists: true, state: "pending_upload" }],
  });
  await expect(readComplete(intent, id(4))).rejects.toThrow();
});
it("binds review to the exact publication target and all native protected subjects", async () => {
  const p = preview();
  call.mockResolvedValueOnce({
    preview: p,
    affected: [
      {
        subject: { type: "reservations", id: id(6) },
        version: 2,
        person_id: id(7),
        center_id: scope.centerId,
      },
    ],
    preserves_reservations: true,
  });
  const before = await previewPublication(target);
  call.mockResolvedValue(p);
  await expect(publicationIntent(target, before, false)).rejects.toThrow();
  await expect(
    publicationIntent({ ...target, versionLabel: "v2" }, before, true),
  ).rejects.toThrow();
  const intent = await publicationIntent(target, before, true);
  expect(intent.request.impact_approval?.accepted_subjects).toEqual([
    { type: "reservations", id: id(6) },
  ]);
  call.mockResolvedValue({ ...p, scope_hash: "changed" });
  await expect(publicationIntent(target, before, true)).rejects.toThrow("DOCUMENT_PREVIEW_STALE");
});
it("keeps organization scope through preview, review, publish and readback", async () => {
  const p = preview();
  const orgTarget = { ...target, level: "organization" as const };
  call.mockResolvedValueOnce({ preview: p, affected: [], preserves_reservations: true });
  const before = await previewPublication(orgTarget);
  call.mockResolvedValueOnce(p);
  const intent = await publicationIntent(orgTarget, before, true);
  call.mockResolvedValueOnce({ status: "succeeded" });
  await writePublication(intent);
  call.mockResolvedValueOnce({
    items: [
      {
        exists: true,
        state: "published",
        entity: { type: "document_versions", id: target.fileId },
        current: {
          operation: "document_version_publish_v1",
          values: {
            document_id: id(9),
            file_id: target.fileId,
            version_label: target.versionLabel,
            scope: { kind: "organization" },
            requirements: intent.request.requirements,
          },
        },
      },
    ],
  });
  await expect(readPublication(intent, target.fileId)).resolves.toMatchObject({
    documentId: id(9),
  });
  expect(call.mock.calls.map(([operation]) => operation)).toEqual([
    "document_publication_preview_v1",
    "preview_get_v1",
    "document_version_publish_v1",
    "management_state_get_v1",
  ]);
  for (const [, request] of call.mock.calls)
    expect(request).toMatchObject({ org_id: scope.orgId, center_id: null });
  expect(call.mock.calls[3]![1]).toMatchObject({
    selector: { key: { file_id: target.fileId, scope: { kind: "organization" } } },
  });
});
it("requires exact published native values and validates receipt operation/ref type", async () => {
  const intent: PublicationIntent = {
    scope,
    request: {
      client_api_version: 1,
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: id(8),
      file_id: id(4),
      version_label: "v1",
      scope: { kind: "center", center_id: scope.centerId },
      requirements: [
        { gate: "sale", scope: { center_ids: [scope.centerId] }, renewed_acceptance: true },
      ],
    },
  };
  const current = {
    operation: "document_version_publish_v1",
    values: {
      document_id: id(9),
      file_id: id(4),
      version_label: "v1",
      scope: { center_id: scope.centerId, kind: "center" },
      requirements: intent.request.requirements,
    },
  };
  call.mockResolvedValue({
    items: [
      {
        entity: { type: "document_versions", id: id(4) },
        exists: true,
        state: "published",
        current,
      },
    ],
  });
  expect(await readPublication(intent, id(4))).toMatchObject({
    documentId: id(9),
    versionLabel: "v1",
  });
  current.values.version_label = "v2";
  await expect(readPublication(intent, id(4))).rejects.toThrow();
  call.mockResolvedValue({
    operation: "document_version_publish_v1",
    key: id(8),
    status: "succeeded",
    result_reference: { type: "files", id: id(4) },
  });
  await expect(documentReceipt(intent)).rejects.toThrow("DOCUMENT_RECEIPT_UNAVAILABLE");
});
