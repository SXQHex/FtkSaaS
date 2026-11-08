import { beforeEach, expect, test, vi } from "vitest";
import { v7 } from "uuid";
import { continueImportUpload, importUploadUrl, type ImportUpload } from "../src/lib/import-upload";
const m = vi.hoisted(() => ({
  call: vi.fn<(op: string, input: unknown) => Promise<unknown>>(),
  upload: vi.fn<() => Promise<unknown>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: m.call,
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: m.upload }) } }),
}));
beforeEach(() => {
  m.call.mockReset();
  m.upload.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test("a lost signed upload reply first verifies the exact existing private file without uploading again", async () => {
  const record: ImportUpload = {
    prepare: {
      org_id: v7(),
      center_id: v7(),
      operation_key: v7(),
      filename: "synthetic.csv",
      mime: "text/csv",
      bytes: 10,
      checksum: "a".repeat(64),
    },
    completeKey: v7(),
    fileId: v7(),
    phase: "upload",
  };
  m.call.mockResolvedValue({});
  const checkpoint = vi.fn<(r: ImportUpload) => void>();
  const result = await continueImportUpload(record, null, checkpoint, () => true);
  expect(result.phase).toBe("ready");
  expect(m.call).toHaveBeenCalledWith("file_upload_complete_v1", {
    org_id: record.prepare.org_id,
    center_id: record.prepare.center_id,
    operation_key: record.completeKey,
    file_id: record.fileId,
    checksum: record.prepare.checksum,
  });
  expect(m.upload).not.toHaveBeenCalled();
});
test("a signed CSV upload grant cannot redirect bytes to another origin, org or bucket", () => {
  const org = v7(),
    file = v7(),
    base = {
      file_id: file,
      upload_url: `/storage/v1/object/upload/sign/ftksaas-imports/${org}/${file}?token=synthetic`,
      allowed_mime: ["text/csv"],
      expires_at: "2099-01-01T00:00:00Z",
      max_bytes: 2097152,
    };
  expect(importUploadUrl(base, org).origin).toBe("https://project.invalid");
  expect(() =>
    importUploadUrl({ ...base, upload_url: `https://evil.invalid${base.upload_url}` }, org),
  ).toThrow("invalidImport");
  expect(() => importUploadUrl(base, v7())).toThrow("invalidImport");
  expect(() =>
    importUploadUrl(
      { ...base, upload_url: base.upload_url.replace("ftksaas-imports", "ftksaas-documents") },
      org,
    ),
  ).toThrow("invalidImport");
});
