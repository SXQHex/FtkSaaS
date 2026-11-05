import { useState } from "react";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { File as NodeFile } from "node:buffer";
import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { DocumentView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { server } from "./mocks/server";
import { SelfDocuments } from "../src/components/documents/self-documents";
import { readContextDocuments, readPrivateDocument } from "../src/lib/document-requirements";
import { setupStorageKey } from "../src/lib/studio-setup";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  other = "019a2b3c-4d5e-7000-8000-000000000081";
const scope = { actorId: id, orgId: other };
const context = { gate: "reservation" as const, subject: { type: "sessions" as const, id } };
const doc: DocumentView = {
  id,
  version_id: other,
  name: "Katılım koşulları",
  content_hash: "synthetic",
  file: { type: "files", id },
  required_at: "reservation",
  accepted: false,
};
const endpoint = "https://project.example.invalid/functions/v1/backend-v1/document_accept_v1";
const NativeURL = URL,
  create = vi.fn<(blob: Blob) => string>().mockReturnValue("blob:self-document"),
  revoke = vi.fn<(url: string) => void>();
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function reads() {
  return {
    read: vi.fn<typeof readContextDocuments>().mockResolvedValue([doc]),
    file: vi
      .fn<typeof readPrivateDocument>()
      .mockResolvedValue(
        new NodeFile(["Koşullar"], "document.txt", { type: "text/plain" }) as unknown as File,
      ),
  };
}
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Katılım koşulları belgesini aç" }));
  await screen.findByText("Koşullar");
}
const success = () =>
  HttpResponse.json({
    ok: true,
    data: { primary_id: id, operation_id: other, replayed: false, related: [] },
    trace_id: id,
  });
test("self reads omit person identity and acceptance needs validated content plus explicit consent", async () => {
  const user = userEvent.setup(),
    api = reads(),
    bodies: Record<string, unknown>[] = [];
  api.read.mockResolvedValueOnce([doc]).mockResolvedValue([{ ...doc, accepted: true }]);
  server.use(
    http.post(endpoint, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      expect(sessionStorage.getItem(setupStorageKey(scope, "document-accept"))).not.toBeNull();
      return success();
    }),
  );
  render(<SelfDocuments scope={scope} context={context} {...api} />);
  await screen.findByText("Kabul gerekli");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  await open(user);
  expect(api.read).toHaveBeenCalledWith({ org_id: other, context });
  expect(api.file).toHaveBeenCalledWith({ org_id: other, context }, doc);
  expect(screen.getByRole("button", { name: "Kendi adıma kabul et" })).toBeDisabled();
  expect(bodies).toHaveLength(0);
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Kendi adıma kabul et" }));
  await screen.findByText("Gereklilik karşılanıyor");
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ org_id: other, context, document_version_id: doc.version_id });
  expect(bodies[0]).not.toHaveProperty("person_id");
  expect(revoke).toHaveBeenCalledWith("blob:self-document");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(api.read).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("heading", { name: "Kendi belgelerim" })).toHaveFocus();
});
test("private-byte failure never mounts an acceptance control", async () => {
  const api = reads();
  api.file.mockRejectedValue(new Error("documentChanged"));
  render(<SelfDocuments scope={scope} context={context} {...api} />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Katılım koşulları belgesini aç" }),
  );
  await screen.findByRole("alert");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
});
test("a met requirement explains carried acceptance and cannot be accepted again", async () => {
  const user = userEvent.setup(),
    api = reads();
  api.read.mockResolvedValue([{ ...doc, accepted: true }]);
  render(<SelfDocuments scope={scope} context={context} {...api} />);
  await open(user);
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getByText(/önceki sürümün kabulü geçerli olabilir/)).toBeInTheDocument();
});
test("uncertain acceptance survives remount and permission loss, replaying the identical context/version/key", async () => {
  const user = userEvent.setup(),
    api = reads(),
    bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(endpoint, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return bodies.length === 1 ? HttpResponse.error() : success();
    }),
  );
  const view = render(<SelfDocuments scope={scope} context={context} {...api} />);
  await open(user);
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Kendi adıma kabul et" }));
  await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  expect(screen.getByRole("heading", { name: "Kendi belgelerim" })).toHaveFocus();
  view.unmount();
  api.read.mockRejectedValue(new Error("denied"));
  render(<SelfDocuments scope={scope} context={context} {...api} />);
  await screen.findByText("Belge gereklilikleri okunamadı veya bu kişi ve işleme erişiminiz yok.");
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect(bodies[1]).toMatchObject({
    context,
    document_version_id: doc.version_id,
    operation_key: bodies[0]?.operation_key,
  });
  expect(bodies[1]?.request_id).not.toBe(bodies[0]?.request_id);
});
function Switch({
  api,
  actorOnly = false,
}: {
  api: ReturnType<typeof reads>;
  actorOnly?: boolean;
}) {
  const [changed, setChanged] = useState(false);
  return (
    <>
      <button onClick={() => setChanged(true)}>Değiştir</button>
      <SelfDocuments
        scope={changed && actorOnly ? { ...scope, actorId: other } : scope}
        context={
          changed && !actorOnly
            ? { gate: "attendance", subject: { type: "sessions", id: other } }
            : context
        }
        {...api}
      />
    </>
  );
}
test.each([false, true])(
  "context/account change discards previous bytes and consent (actorOnly=%s)",
  async (actorOnly) => {
    const user = userEvent.setup(),
      api = reads();
    render(<Switch api={api} actorOnly={actorOnly} />);
    await open(user);
    await user.click(screen.getByRole("checkbox"));
    api.read.mockRejectedValue(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "Değiştir" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Koşullar")).not.toBeInTheDocument();
    expect(revoke).toHaveBeenCalledWith("blob:self-document");
  },
);
test("late private-byte response after closing cannot restore acceptance", async () => {
  const user = userEvent.setup(),
    api = reads();
  let finish!: (value: File) => void;
  api.file.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<SelfDocuments scope={scope} context={context} {...api} />);
  await user.click(await screen.findByRole("button", { name: "Katılım koşulları belgesini aç" }));
  await user.click(screen.getByRole("button", { name: "Belgeyi kapat" }));
  await act(async () =>
    finish(new NodeFile(["late"], "document.txt", { type: "text/plain" }) as unknown as File),
  );
  expect(create).not.toHaveBeenCalled();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});

test("storage failure prevents sending acceptance and reopening requires fresh consent", async () => {
  const user = userEvent.setup(),
    api = reads(),
    send = vi.fn<() => void>();
  server.use(
    http.post(endpoint, () => {
      send();
      return success();
    }),
  );
  render(<SelfDocuments scope={scope} context={context} {...api} />);
  await open(user);
  await user.click(screen.getByRole("checkbox"));
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("disabled");
  });
  await user.click(screen.getByRole("button", { name: "Kendi adıma kabul et" }));
  await screen.findByRole("alert");
  expect(send).not.toHaveBeenCalled();
  storage.mockRestore();
  await open(user);
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Kendi adıma kabul et" })).toBeDisabled();
});
test("a stale version refusal never marks accepted and reloading a new version requires fresh consent", async () => {
  const user = userEvent.setup(),
    api = reads(),
    bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(endpoint, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(
        {
          ok: false,
          error: { code: "VERSION_CONFLICT", message: "synthetic conflict" },
          trace_id: id,
        },
        { status: 409 },
      );
    }),
  );
  render(<SelfDocuments scope={scope} context={context} {...api} />);
  await open(user);
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Kendi adıma kabul et" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("Gereklilik karşılanıyor")).not.toBeInTheDocument();
  expect(sessionStorage.getItem(setupStorageKey(scope, "document-accept"))).toBeNull();
  api.read.mockResolvedValue([{ ...doc, version_id: id }]);
  await user.click(screen.getByRole("button", { name: "Yeniden yükle" }));
  await open(user);
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(api.file).toHaveBeenLastCalledWith({ org_id: other, context }, { ...doc, version_id: id });
  expect(bodies).toHaveLength(1);
});

test("final failure recovered by status clears the journal and returns focus without pretending acceptance", async () => {
  const api = reads(),
    key = setupStorageKey(scope, "document-accept");
  sessionStorage.setItem(
    key,
    JSON.stringify({
      command: {
        operation: "document_accept_v1",
        input: { org_id: other, context, document_version_id: doc.version_id, operation_key: id },
      },
    }),
  );
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/operation_status_get_v1",
      () =>
        HttpResponse.json({
          ok: true,
          data: {
            operation: "document_accept_v1",
            key: id,
            status: "failed_final",
            result_available: false,
            result_reference: null,
          },
          trace_id: id,
        }),
    ),
  );
  render(<SelfDocuments scope={scope} context={context} {...api} />);
  await userEvent.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  await waitFor(() => expect(sessionStorage.getItem(key)).toBeNull());
  expect(screen.getByRole("heading", { name: "Kendi belgelerim" })).toHaveFocus();
  expect(screen.queryByText("Gereklilik karşılanıyor")).not.toBeInTheDocument();
});
