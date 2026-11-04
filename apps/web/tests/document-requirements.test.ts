import { beforeEach, expect, test, vi } from "vitest";
import { webcrypto, createHash } from "node:crypto";
import { File as NodeFile } from "node:buffer";
import type { DocumentView } from "@ftksaas/api-contracts";
import {
  readContextDocuments,
  readPrivateDocument,
  listSessionDocumentContexts,
} from "../src/lib/document-requirements";
import { setupCall } from "../src/lib/studio-setup";
vi.mock("../src/lib/studio-setup", async (original) => ({
  ...(await original<typeof import("../src/lib/studio-setup")>()),
  setupCall: vi.fn<typeof import("../src/lib/studio-setup").setupCall>(),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  other = "019a2b3c-4d5e-7000-8000-000000000081";
const query = {
  org_id: id,
  person_id: other,
  context: { gate: "reservation" as const, subject: { type: "reservations" as const, id } },
};
const content = "Sentetik belge. Kayıt oluşturmaz.";
const hash = createHash("sha256").update(content).digest("hex");
const doc: DocumentView = {
  id,
  version_id: other,
  name: "Katılım koşulları",
  content_hash: hash,
  required_at: "reservation",
  accepted: false,
  file: { type: "files", id: other },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("File", NodeFile);
});
test("document reads preserve real reservation/person context and never substitute account identity", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce([doc]);
  expect(await readContextDocuments(query)).toEqual([doc]);
  expect(setupCall).toHaveBeenCalledWith("document_requirements_get_v1", query);
});
test("private file bytes are selected by exact required document, version, file and hash", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce([
    {
      ...doc,
      content: {
        mime: "text/plain",
        encoding: "base64",
        data: Buffer.from(content).toString("base64"),
      },
    },
  ]);
  const file = await readPrivateDocument(query, doc);
  expect(await file.text()).toBe(content);
  expect(file.type).toBe("text/plain");
  expect(setupCall).toHaveBeenCalledWith("document_requirements_get_v1", {
    ...query,
    content_file_id: other,
  });
});
test("a newly required version invalidates an old file opening", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce([
    {
      ...doc,
      version_id: id,
      content: {
        mime: "text/plain",
        encoding: "base64",
        data: Buffer.from(content).toString("base64"),
      },
    },
  ]);
  await expect(readPrivateDocument(query, doc)).rejects.toThrow("documentChanged");
});
test("corrupt and oversized bytes never produce a file URL", async () => {
  for (const data of [
    Buffer.from("changed content").toString("base64"),
    "<invalid>",
    "A".repeat(2796208),
  ]) {
    vi.mocked(setupCall).mockResolvedValueOnce([
      { ...doc, content: { mime: "text/plain", encoding: "base64", data } },
    ]);
    await expect(readPrivateDocument(query, doc)).rejects.toThrow("invalidDocumentContent");
  }
});
test("a backend denial stays an error instead of an empty list", async () => {
  const denied = new Error("denied");
  vi.mocked(setupCall).mockRejectedValueOnce(denied);
  await expect(readContextDocuments(query)).rejects.toBe(denied);
});
test("document context discovery uses the authorized session and scoped ascending cursor", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce({
    items: [],
    next_cursor: null,
    as_of: "2026-11-04T00:00:00Z",
  });
  await listSessionDocumentContexts({ actorId: other, orgId: id }, other, "cursor");
  expect(setupCall).toHaveBeenCalledWith("reservation_list_v1", {
    org_id: id,
    session_id: other,
    page: { limit: 25, sort: "created_at_asc", cursor: "cursor" },
  });
});
