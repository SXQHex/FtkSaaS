import { beforeEach, expect, test, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UploadRef } from "@ftksaas/api-contracts";
import { render } from "./render";
import { DocumentUpload } from "../src/components/documents/document-upload";
import { setupCall } from "../src/lib/studio-setup";
import { browserClient } from "../src/lib/supabase/client";
import { uploadStorageKey } from "../src/lib/documents";
vi.mock("../src/lib/studio-setup", async (original) => ({
  ...(await original<typeof import("../src/lib/studio-setup")>()),
  setupCall: vi.fn<typeof import("../src/lib/studio-setup").setupCall>(),
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: vi.fn<typeof import("../src/lib/supabase/client").browserClient>(),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  fid = "019a2b3c-4d5e-7000-8000-000000000081";
const scope = { actorId: fid, orgId: id };
const grant: UploadRef = {
  file_id: fid,
  upload_url: `/storage/v1/object/upload/sign/ftksaas-documents/${id}/${fid}?token=synthetic`,
  expires_at: "2099-01-01T00:00:00Z",
  allowed_mime: ["text/plain"],
  max_bytes: 5,
};
const saved = { primary_id: fid, operation_id: id, replayed: true, related: [] };
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
  vi.mocked(browserClient).mockReturnValue({
    storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: null }) }) },
  } as unknown as ReturnType<typeof browserClient>);
});
function file() {
  const value = new File(["hello"], "consent.txt", { type: "text/plain" });
  Object.defineProperty(value, "arrayBuffer", {
    value: async () => new TextEncoder().encode("hello").buffer,
  });
  return value;
}
test("a lost completion reply survives reload and resumes without selecting or re-uploading the file", async () => {
  const user = userEvent.setup();
  const ready = vi.fn<(id: string, documentId?: string) => void>();
  vi.mocked(setupCall).mockResolvedValueOnce(grant).mockRejectedValueOnce(new Error("lost reply"));
  const view = render(<DocumentUpload scope={scope} onReady={ready} />);
  await user.upload(screen.getByLabelText("Belge dosyası"), file());
  await user.click(screen.getByRole("button", { name: "Dosyayı yükle ve doğrula" }));
  await screen.findByRole("alert");
  const pending = JSON.parse(sessionStorage.getItem(uploadStorageKey(scope))!);
  expect(pending.phase).toBe("complete");
  expect(pending).not.toHaveProperty("upload_url");
  expect(ready).not.toHaveBeenCalled();
  view.unmount();
  vi.mocked(setupCall).mockResolvedValueOnce(saved);
  vi.mocked(browserClient).mockClear();
  render(<DocumentUpload scope={scope} onReady={ready} />);
  await user.click(screen.getByRole("button", { name: "Aynı yüklemeyi sürdür" }));
  await screen.findByText(/consent.txt doğrulandı/);
  expect(browserClient).not.toHaveBeenCalled();
  expect(setupCall).toHaveBeenLastCalledWith(
    "file_upload_complete_v1",
    expect.objectContaining({
      operation_key: pending.completeKey,
      checksum: pending.checksum,
      file_id: fid,
    }),
  );
  expect(ready).toHaveBeenCalledWith(fid, undefined);
});
test("failed journal writes prevent preparing or uploading a file", async () => {
  const user = userEvent.setup();
  const ready = vi.fn<(id: string) => void>();
  render(<DocumentUpload scope={scope} onReady={ready} />);
  await user.upload(screen.getByLabelText("Belge dosyası"), file());
  const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  try {
    await user.click(screen.getByRole("button", { name: "Dosyayı yükle ve doğrula" }));
    await screen.findByRole("alert");
    expect(setupCall).not.toHaveBeenCalled();
    expect(browserClient).not.toHaveBeenCalled();
  } finally {
    blocked.mockRestore();
  }
});
test("expired prepare with a lost grant reply can be explicitly abandoned after checking its completed receipt", async () => {
  const user = userEvent.setup();
  const record = {
    prepare: { org_id: id, operation_key: fid, name: "consent.txt", mime: "text/plain", bytes: 5 },
    checksum: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    completeKey: id,
    phase: "prepare",
  };
  sessionStorage.setItem(uploadStorageKey(scope), JSON.stringify(record));
  vi.mocked(setupCall)
    .mockResolvedValueOnce({
      operation: "document_upload_prepare_v1",
      key: fid,
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
  render(
    <DocumentUpload
      scope={scope}
      onReady={() => {
        throw Error("Not completed");
      }}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Bu yüklemeyi bırak ve yeni dosya başlat" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Yükleme durumunu doğrula" }));
  await user.click(
    await screen.findByRole("button", { name: "Bu yüklemeyi bırak ve yeni dosya başlat" }),
  );
  expect(sessionStorage.getItem(uploadStorageKey(scope))).toBeNull();
  expect(screen.getByRole("button", { name: "Dosyayı yükle ve doğrula" })).toBeDisabled();
});
test("final expired completion can restart while retaining the existing document's new-version target after reload", async () => {
  const user = userEvent.setup();
  const documentId = "019a2b3c-4d5e-7000-8000-000000000082";
  const ready = vi.fn<(id: string, documentId?: string) => void>();
  sessionStorage.setItem(
    uploadStorageKey(scope),
    JSON.stringify({
      prepare: {
        org_id: id,
        operation_key: fid,
        name: "consent.txt",
        mime: "text/plain",
        bytes: 5,
      },
      checksum: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      completeKey: id,
      phase: "complete",
      fileId: fid,
      expiresAt: "2020-01-01T00:00:00Z",
      documentId,
    }),
  );
  vi.mocked(setupCall)
    .mockResolvedValueOnce({
      operation: "file_upload_complete_v1",
      key: id,
      status: "failed_final",
      result_available: false,
      result_reference: null,
    })
    .mockResolvedValueOnce(grant)
    .mockResolvedValueOnce(saved);
  render(<DocumentUpload scope={scope} onReady={ready} />);
  expect(
    screen.queryByRole("button", { name: "Bu yüklemeyi bırak ve yeni dosya başlat" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Yükleme durumunu doğrula" }));
  await user.click(
    await screen.findByRole("button", { name: "Bu yüklemeyi bırak ve yeni dosya başlat" }),
  );
  await user.upload(screen.getByLabelText("Belge dosyası"), file());
  await user.click(screen.getByRole("button", { name: "Dosyayı yükle ve doğrula" }));
  await screen.findByText(/consent.txt doğrulandı/);
  expect(ready).toHaveBeenCalledWith(fid, documentId);
});
