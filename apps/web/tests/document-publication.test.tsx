import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Operations } from "@ftksaas/api-contracts";
import { render } from "./render";
import { DocumentPublicationForm } from "../src/components/documents/document-publication";
import { setupCall } from "../src/lib/studio-setup";
import type { useSetupCommand } from "../src/components/setup/setup-command";
vi.mock("../src/lib/studio-setup", async (original) => ({
  ...(await original<typeof import("../src/lib/studio-setup")>()),
  setupCall: vi.fn<typeof import("../src/lib/studio-setup").setupCall>(),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  other = "019a2b3c-4d5e-7000-8000-000000000081";
const scope = { actorId: other, orgId: id, centerId: other };
const result: Operations["document_publication_preview_v1"]["response"]["data"] = {
  preview: {
    id,
    token: "synthetic-preview",
    scope_hash: "hash",
    dependencies: { versions: [], policy_hashes: [], permission_hash: "hash" },
    effects: [],
    blockers: [],
    expires_at: "2099-01-01T00:00:00Z",
  },
  affected: [
    { subject: { type: "reservations", id: other }, version: 3, person_id: id, center_id: other },
  ],
  preserves_reservations: true,
};
function command(): ReturnType<typeof useSetupCommand> {
  return {
    busy: false,
    pending: null,
    message: "",
    run: vi.fn<ReturnType<typeof useSetupCommand>["run"]>().mockResolvedValue(undefined),
    check: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setupCall).mockResolvedValue(result);
});
async function fill() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Sürüm etiketi"), "2026.11");
  await user.click(screen.getByLabelText("Yoklama", { exact: true }));
  await user.click(screen.getByLabelText("Önceki sürümü kabul edenlerden yeniden kabul iste"));
  await user.click(screen.getByRole("button", { name: "Yayın etkisini incele" }));
  return user;
}
test("publication requires explicit complete effect approval and publishes the exact scoped preview snapshot", async () => {
  const c = command();
  render(<DocumentPublicationForm scope={scope} fileId={other} documentId={id} command={c} />);
  const user = await fill();
  expect(c.run).not.toHaveBeenCalled();
  expect(await screen.findByText(/Korunacak mevcut kesin kayıt: 1/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sürümü yayımla" })).toBeDisabled();
  expect(setupCall).toHaveBeenCalledWith("document_publication_preview_v1", {
    org_id: id,
    center_id: other,
    document_id: id,
    file_id: other,
    version_label: "2026.11",
    scope: { kind: "center", center_id: other },
    requirements: [
      { gate: "attendance", scope: { center_ids: [other] }, renewed_acceptance: true },
    ],
  });
  await user.click(screen.getByRole("checkbox", { name: /Bu sürümün kapsamını/ }));
  await user.click(screen.getByRole("button", { name: "Sürümü yayımla" }));
  expect(c.run).toHaveBeenCalledOnce();
  expect(c.run).toHaveBeenCalledWith({
    operation: "document_version_publish_v1",
    input: expect.objectContaining({
      document_id: id,
      file_id: other,
      version_label: "2026.11",
      requirements: [
        { gate: "attendance", scope: { center_ids: [other] }, renewed_acceptance: true },
      ],
      impact_approval: {
        preview: { id, token: "synthetic-preview" },
        accepted_subjects: [{ type: "reservations", id: other }],
      },
    }),
  });
  expect(screen.queryByRole("button", { name: "Sürümü yayımla" })).not.toBeInTheDocument();
});
test("editing publication inputs discards the previous effect approval", async () => {
  const c = command();
  render(<DocumentPublicationForm scope={scope} fileId={other} command={c} />);
  const user = await fill();
  await screen.findByRole("button", { name: "Sürümü yayımla" });
  await user.click(screen.getByRole("checkbox", { name: /Bu sürümün kapsamını/ }));
  await user.type(screen.getByLabelText("Sürüm etiketi"), "x");
  expect(screen.queryByRole("button", { name: "Sürümü yayımla" })).not.toBeInTheDocument();
  expect(c.run).not.toHaveBeenCalled();
});
test("expired publication preview cannot be published even after explicit approval", async () => {
  vi.mocked(setupCall).mockResolvedValue({
    ...result,
    preview: { ...result.preview, expires_at: "2020-01-01T00:00:00Z" },
  });
  const c = command();
  render(<DocumentPublicationForm scope={scope} fileId={other} command={c} />);
  const user = await fill();
  await user.click(await screen.findByRole("checkbox", { name: /Bu sürümün kapsamını/ }));
  await user.click(screen.getByRole("button", { name: "Sürümü yayımla" }));
  await screen.findByText("Önizlemenin süresi doldu. Güncel etkiyi yeniden inceleyin.");
  expect(c.run).not.toHaveBeenCalled();
});
test("a late preview from an unmounted scope never opens an approval", async () => {
  let resolve: (r: typeof result) => void = () => {};
  vi.mocked(setupCall).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }) as ReturnType<typeof setupCall>,
  );
  const c = command();
  const view = render(<DocumentPublicationForm scope={scope} fileId={other} command={c} />);
  await fill();
  view.unmount();
  resolve(result);
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Sürümü yayımla" })).not.toBeInTheDocument(),
  );
  expect(c.run).not.toHaveBeenCalled();
});
