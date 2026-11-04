import { beforeEach, expect, test, vi } from "vitest";
import { File as NodeFile } from "node:buffer";
import { webcrypto as nodeCrypto } from "node:crypto";
import type { UploadRef } from "@ftksaas/api-contracts";
import {
  documentUploadUrl,
  documentFileHash,
  restoreUpload,
  uploadStorageKey,
  continueDocumentUpload,
  type UploadJournal,
} from "../src/lib/documents";
import { setupCall } from "../src/lib/studio-setup";
import { browserClient } from "../src/lib/supabase/client";
vi.mock("../src/lib/studio-setup", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/studio-setup")>()),
  setupCall: vi.fn<typeof import("../src/lib/studio-setup").setupCall>(),
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: vi.fn<typeof import("../src/lib/supabase/client").browserClient>(),
}));
const org = "019a2b3c-4d5e-7000-8000-000000000080",
  fid = "019a2b3c-4d5e-7000-8000-000000000081";
const scope = { actorId: fid, orgId: org };
const base = "https://project.example.invalid";
const grant: UploadRef = {
  file_id: fid,
  upload_url: `/storage/v1/object/upload/sign/ftksaas-documents/${org}/${fid}?token=synthetic`,
  expires_at: "2099-01-01T00:00:00Z",
  allowed_mime: ["text/plain"],
  max_bytes: 5,
};
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("crypto", nodeCrypto);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", base);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test("signed upload URL stays on the configured Storage origin and exact organization/file path", () => {
  expect(documentUploadUrl(grant, org).searchParams.get("token")).toBe("synthetic");
  for (const upload_url of [
    `https://evil.invalid${grant.upload_url}`,
    `//evil.invalid${grant.upload_url}`,
    grant.upload_url.replace(org, fid),
    grant.upload_url.replace("upload/sign", "authenticated"),
    grant.upload_url + "#fragment",
  ])
    expect(() => documentUploadUrl({ ...grant, upload_url }, org)).toThrow("invalidUpload");
});
test("file validation rejects wrong MIME, empty/oversized content and hash mismatch", async () => {
  const file = new NodeFile(["hello"], "consent.txt", { type: "text/plain" }) as unknown as File;
  expect(await documentFileHash(file)).toBe(
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
  for (const bad of [
    new NodeFile(["x"], "x.html", { type: "text/html" }),
    new NodeFile([], "empty.txt", { type: "text/plain" }),
    new NodeFile([new Uint8Array(2097153)], "large.pdf", { type: "application/pdf" }),
  ])
    await expect(documentFileHash(bad as unknown as File)).rejects.toThrow("invalidFile");
});
const record: UploadJournal = {
  prepare: { org_id: org, operation_key: fid, name: "consent.txt", mime: "text/plain", bytes: 5 },
  checksum: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  completeKey: org,
  phase: "prepare",
};
test("reload rejects corrupt/cross-tenant journals and never persists signed URLs or file bytes", () => {
  const key = uploadStorageKey(scope);
  sessionStorage.setItem(key, JSON.stringify(record));
  expect(restoreUpload(scope)).toEqual(record);
  for (const bad of [
    { ...record, prepare: { ...record.prepare, org_id: fid } },
    { ...record, upload_url: grant.upload_url },
    { ...record, checksum: "bad" },
    { ...record, phase: "complete" },
  ]) {
    sessionStorage.setItem(key, JSON.stringify(bad));
    expect(restoreUpload(scope)).toBe("invalid");
  }
});
test("upload completion resumes with original file/key and validates an existing object instead of overwriting", async () => {
  const upload = vi
    .fn<() => Promise<{ error: { statusCode: string } | null }>>()
    .mockResolvedValue({ error: { statusCode: "409" } });
  vi.mocked(browserClient).mockReturnValue({
    storage: { from: () => ({ uploadToSignedUrl: upload }) },
  } as unknown as ReturnType<typeof browserClient>);
  vi.mocked(setupCall)
    .mockResolvedValueOnce(grant)
    .mockResolvedValueOnce({ primary_id: fid, operation_id: org, replayed: false, related: [] });
  const checkpoints: UploadJournal[] = [];
  const result = await continueDocumentUpload(
    scope,
    record,
    new NodeFile(["hello"], "consent.txt", { type: "text/plain" }) as unknown as File,
    (r) => {
      checkpoints.push(r);
    },
  );
  expect(result.phase).toBe("ready");
  expect(upload.mock.calls[0]).toEqual([
    `${org}/${fid}`,
    "synthetic",
    expect.objectContaining({ byteLength: 5 }),
    { contentType: "text/plain", upsert: false },
  ]);
  expect(setupCall).toHaveBeenLastCalledWith("file_upload_complete_v1", {
    org_id: org,
    file_id: fid,
    checksum: record.checksum,
    operation_key: record.completeKey,
  });
  expect(checkpoints.map((r) => r.phase)).toEqual(["upload", "complete", "ready"]);
  expect(JSON.stringify(checkpoints)).not.toContain("synthetic");
});
test("after completion response loss, reload replays completion without re-uploading or choosing a new key", async () => {
  vi.mocked(setupCall).mockResolvedValue({
    primary_id: fid,
    operation_id: org,
    replayed: true,
    related: [],
  });
  const pending: UploadJournal = { ...record, phase: "complete", fileId: fid };
  const result = await continueDocumentUpload(scope, pending, null, () => {});
  expect(result.phase).toBe("ready");
  expect(browserClient).not.toHaveBeenCalled();
  expect(setupCall).toHaveBeenCalledTimes(1);
  expect(setupCall).toHaveBeenCalledWith(
    "file_upload_complete_v1",
    expect.objectContaining({
      operation_key: record.completeKey,
      checksum: record.checksum,
      file_id: fid,
    }),
  );
});
test("a different reselected file never reaches Storage or completion", async () => {
  await expect(
    continueDocumentUpload(
      scope,
      record,
      new NodeFile(["other"], "consent.txt", { type: "text/plain" }) as unknown as File,
      () => {},
    ),
  ).rejects.toThrow("sameFileRequired");
  expect(setupCall).not.toHaveBeenCalled();
  expect(browserClient).not.toHaveBeenCalled();
});
test("document lists use real selectors, current scope and bound cursors", async () => {
  const { listDocumentFiles, listDocumentPublications } = await import("../src/lib/documents");
  vi.mocked(setupCall).mockResolvedValue({
    items: [],
    next_cursor: null,
    as_of: "2026-11-04T00:00:00Z",
  });
  await listDocumentFiles(scope, "file-cursor");
  await listDocumentPublications(scope, fid, "version-cursor");
  expect(setupCall).toHaveBeenNthCalledWith(1, "management_state_get_v1", {
    org_id: org,
    operation: "document_upload_prepare_v1",
    selector: { operation: "document_upload_prepare_v1", key: {} },
    page: { limit: 25, sort: "created_at_asc", cursor: "file-cursor" },
  });
  expect(setupCall).toHaveBeenNthCalledWith(2, "management_state_get_v1", {
    org_id: org,
    operation: "document_version_publish_v1",
    selector: {
      operation: "document_version_publish_v1",
      key: { file_id: fid, scope: { kind: "organization" } },
    },
    page: { limit: 25, sort: "created_at_asc", cursor: "version-cursor" },
  });
});
test("lost prepare response can be reconciled after expiry without confusing file preparation with verified completion", async () => {
  const { reconcileDocumentUpload } = await import("../src/lib/documents");
  vi.mocked(setupCall)
    .mockResolvedValueOnce({
      operation: "document_upload_prepare_v1",
      key: record.prepare.operation_key,
      status: "succeeded",
      result_available: true,
      result_reference: { type: "files", id: fid },
    })
    .mockResolvedValueOnce({
      items: [
        {
          operation: "file_upload_complete_v1",
          exists: true,
          entity: { type: "files", id: fid },
          state: "pending_upload",
          versions: [],
          as_of: "2026-11-04T00:00:00Z",
          current: { operation: "file_upload_complete_v1", values: { file_id: fid } },
        },
      ],
      next_cursor: null,
      as_of: "2026-11-04T00:00:00Z",
    });
  const reconciled = await reconcileDocumentUpload(scope, record);
  expect(reconciled).toMatchObject({ phase: "prepare", fileId: fid, restartable: true });
  expect(reconciled.phase).not.toBe("ready");
});
test("expired completion with a final failure releases the upload slot only after receipt reconciliation", async () => {
  const { reconcileDocumentUpload } = await import("../src/lib/documents");
  const pending: UploadJournal = {
    ...record,
    phase: "complete",
    fileId: fid,
    expiresAt: "2020-01-01T00:00:00Z",
  };
  vi.mocked(setupCall).mockResolvedValueOnce({
    operation: "file_upload_complete_v1",
    key: pending.completeKey,
    status: "failed_final",
    result_available: false,
    result_reference: null,
  });
  expect(await reconcileDocumentUpload(scope, pending)).toMatchObject({
    phase: "complete",
    blocked: true,
    restartable: true,
  });
  vi.mocked(setupCall).mockResolvedValueOnce({
    operation: "file_upload_complete_v1",
    key: pending.completeKey,
    status: "in_progress",
    result_available: false,
    result_reference: null,
  });
  expect(await reconcileDocumentUpload(scope, pending)).toEqual(pending);
});
test("an uncertain transfer is completed before requesting another signed grant", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce({
    primary_id: fid,
    operation_id: org,
    replayed: false,
    related: [],
  });
  expect(
    (
      await continueDocumentUpload(
        scope,
        { ...record, fileId: fid, phase: "upload" },
        null,
        () => {},
      )
    ).phase,
  ).toBe("ready");
  expect(setupCall).toHaveBeenCalledTimes(1);
  expect(setupCall).toHaveBeenCalledWith(
    "file_upload_complete_v1",
    expect.objectContaining({ file_id: fid, operation_key: record.completeKey }),
  );
  expect(browserClient).not.toHaveBeenCalled();
});
