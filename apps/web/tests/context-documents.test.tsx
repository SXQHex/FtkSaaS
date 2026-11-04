import { useState } from "react";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { File as NodeFile } from "node:buffer";
import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DocumentView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { ContextDocuments } from "../src/components/documents/context-documents";
import type { DocumentQuery, DocumentReadActions } from "../src/lib/document-requirements";
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  other = "019a2b3c-4d5e-7000-8000-000000000081";
const query: DocumentQuery = {
  org_id: id,
  person_id: other,
  context: { gate: "reservation", subject: { type: "reservations", id } },
};
const doc: DocumentView = {
  id,
  version_id: other,
  name: "Katılım koşulları",
  required_at: "reservation",
  accepted: false,
  content_hash: "synthetic",
  file: { type: "files", id: other },
};
const NativeURL = URL;
const create = vi.fn<(blob: Blob) => string>().mockReturnValue("blob:synthetic-document"),
  revoke = vi.fn<(url: string) => void>();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("File", NodeFile);
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
function actions(): DocumentReadActions {
  return {
    read: vi.fn<DocumentReadActions["read"]>().mockResolvedValue([doc]),
    person: vi.fn<DocumentReadActions["person"]>().mockResolvedValue({
      id: other,
      display_name: "Deniz Örnek",
      relationships: [],
      version: 1,
      discipline_relationships: [],
    }),
    file: vi.fn<DocumentReadActions["file"]>().mockResolvedValue(
      new NodeFile(["<script>sentetik</script>"], "document.txt", {
        type: "text/plain",
      }) as unknown as File,
    ),
  };
}
test("requirements read a real participant/context and opening a file never exposes an acceptance command", async () => {
  const user = userEvent.setup(),
    api = actions();
  render(<ContextDocuments actorId={id} query={query} actions={api} />);
  await screen.findByText("Deniz Örnek");
  expect(api.read).toHaveBeenCalledWith(query);
  expect(screen.getByText("Kabul gerekli")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Kabul et|Onayla/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Katılım koşulları belgesini aç" }));
  await screen.findByText("<script>sentetik</script>");
  expect(document.querySelector("article script")).toBeNull();
  expect(screen.getByRole("link", { name: "Dosyayı indir" })).toHaveAttribute(
    "href",
    "blob:synthetic-document",
  );
  expect(api.file).toHaveBeenCalledWith(query, doc);
  await user.click(screen.getByRole("button", { name: "Belgeyi kapat" }));
  expect(revoke).toHaveBeenCalledWith("blob:synthetic-document");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Katılım koşulları belgesini aç" })).toHaveFocus(),
  );
});
test("met requirement does not claim the current version was explicitly accepted", async () => {
  const api = actions();
  vi.mocked(api.read).mockResolvedValue([{ ...doc, accepted: true }]);
  render(<ContextDocuments actorId={id} query={query} actions={api} />);
  await screen.findByText("Gereklilik karşılanıyor");
  expect(screen.getByText(/önceki sürümün kabulü geçerli olabilir/)).toBeInTheDocument();
});
test("permission failure is not an empty requirements success", async () => {
  const api = actions();
  vi.mocked(api.read).mockRejectedValue(new Error("denied"));
  render(<ContextDocuments actorId={id} query={query} actions={api} />);
  await screen.findByRole("alert");
  expect(screen.queryByText("Bu kişi ve işlem için gerekli belge yok.")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Katılım koşulları belgesini aç" }),
  ).not.toBeInTheDocument();
});
test("refresh revokes private bytes and removes old requirements before the new read", async () => {
  const user = userEvent.setup(),
    api = actions();
  render(<ContextDocuments actorId={id} query={query} actions={api} />);
  await user.click(await screen.findByRole("button", { name: "Katılım koşulları belgesini aç" }));
  await screen.findByRole("link", { name: "Dosyayı indir" });
  vi.mocked(api.read).mockRejectedValue(new Error("denied"));
  await user.click(screen.getByRole("button", { name: "Yeniden yükle" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("link", { name: "Dosyayı indir" })).not.toBeInTheDocument();
  expect(revoke).toHaveBeenCalledWith("blob:synthetic-document");
});
test("a document version change never falls back to previously selected file bytes", async () => {
  const user = userEvent.setup(),
    api = actions();
  vi.mocked(api.file).mockRejectedValue(new Error("documentChanged"));
  render(<ContextDocuments actorId={id} query={query} actions={api} />);
  await user.click(await screen.findByRole("button", { name: "Katılım koşulları belgesini aç" }));
  await screen.findByText(
    "Belge sürümü değişti. Gereklilikleri yeniden yükleyip güncel belgeyi açın.",
  );
  expect(create).not.toHaveBeenCalled();
});
test("a late private read after unmount creates no object URL", async () => {
  const user = userEvent.setup(),
    api = actions();
  let resolve: (file: File) => void = () => {};
  vi.mocked(api.file).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const view = render(<ContextDocuments actorId={id} query={query} actions={api} />);
  await user.click(await screen.findByRole("button", { name: "Katılım koşulları belgesini aç" }));
  view.unmount();
  await act(async () => {
    resolve(new NodeFile(["old"], "old.txt", { type: "text/plain" }) as unknown as File);
  });
  expect(create).not.toHaveBeenCalled();
});

function ContextSwitch({
  api,
  actorOnly = false,
}: {
  api: DocumentReadActions;
  actorOnly?: boolean;
}) {
  const [changed, setChanged] = useState(false);
  return (
    <>
      <button onClick={() => setChanged(true)}>Bağlamı değiştir</button>
      <ContextDocuments
        actorId={changed ? id : other}
        query={
          changed && !actorOnly
            ? {
                ...query,
                person_id: id,
                context: { gate: "attendance", subject: { type: "reservations", id: other } },
              }
            : query
        }
        actions={api}
      />
    </>
  );
}
test("query change with a denied new read removes previous participant and private bytes", async () => {
  const user = userEvent.setup(),
    api = actions();
  render(<ContextSwitch api={api} />);
  await user.click(await screen.findByRole("button", { name: "Katılım koşulları belgesini aç" }));
  await screen.findByRole("link", { name: "Dosyayı indir" });
  vi.mocked(api.read).mockRejectedValue(new Error("new scope denied"));
  await user.click(screen.getByRole("button", { name: "Bağlamı değiştir" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("link", { name: "Dosyayı indir" })).not.toBeInTheDocument();
  expect(revoke).toHaveBeenCalledWith("blob:synthetic-document");
});
test("account identity change unmounts private bytes even when domain query is unchanged", async () => {
  const user = userEvent.setup(),
    api = actions();
  render(<ContextSwitch api={api} actorOnly />);
  await user.click(await screen.findByRole("button", { name: "Katılım koşulları belgesini aç" }));
  await screen.findByRole("link", { name: "Dosyayı indir" });
  await user.click(screen.getByRole("button", { name: "Bağlamı değiştir" }));
  expect(screen.queryByRole("link", { name: "Dosyayı indir" })).not.toBeInTheDocument();
  expect(revoke).toHaveBeenCalledWith("blob:synthetic-document");
});
