import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EntitlementView, Preview } from "@ftksaas/api-contracts";
import { render } from "./render";
import { SaleLifecycle } from "../src/components/products/sale-lifecycle";
import { setupStorageKey, type SetupCommand } from "../src/lib/studio-setup";
const send = vi.hoisted(() => vi.fn<(command: SetupCommand) => Promise<{ primary_id: string }>>());
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  sendSetupCommand: send,
}));
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  person = "019a2b3c-4d5e-7000-8000-000000000002",
  freezeId = "019a2b3c-4d5e-7000-8000-000000000003";
const scope = { actorId: id, orgId: id, centerId: id };
const row: EntitlementView = {
  sale_id: id,
  person_id: person,
  start_date: "2030-01-01",
  end_date: "2031-01-01",
  timezone: "Europe/Istanbul",
  state: "active",
  sale_state: "active",
  available: 8,
  reserved: 2,
  consumed: 3,
  deficit: 0,
  quotas: [],
  deficit_scopes: [],
  freezes: [
    {
      id: freezeId,
      created_at: "2030-01-01T00:00:00Z",
      org_id: id,
      sale_id: id,
      starts_at: "2030-02-01T00:00:00Z",
      planned_end: "2030-03-01T00:00:00Z",
      state: "scheduled",
      preview_id: id,
    },
  ],
};
const preview: Preview = {
  id,
  token: "proof",
  scope_hash: "scope",
  expires_at: "2099-01-01T00:00:00Z",
  effects: [{ entity: { type: "reservations", id: freezeId }, action: "adjust" }],
  blockers: [],
  dependencies: {
    versions: [{ entity: { type: "sales", id }, version: 4 }],
    policy_hashes: [],
    permission_hash: "perm",
  },
};
const api = {
  freeze: vi.fn<typeof import("../src/lib/sale-lifecycle").lifecycleApi.freeze>(),
  end: vi.fn<typeof import("../src/lib/sale-lifecycle").lifecycleApi.end>(),
  terminate: vi.fn<typeof import("../src/lib/sale-lifecycle").lifecycleApi.terminate>(),
};
const read = vi.fn<typeof import("../src/lib/products").readEntitlements>(),
  saved = vi.fn<() => void>();
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  read.mockResolvedValue([row]);
  send.mockResolvedValue({ primary_id: id });
  api.freeze.mockResolvedValue(preview);
  api.end.mockResolvedValue(preview);
  api.terminate.mockResolvedValue(preview);
});
async function fill(kind: "freeze" | "freeze_end" | "terminate") {
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByLabelText("İşlem yapılacak paket"), id);
  await user.click(
    screen.getByRole("button", {
      name:
        kind === "freeze"
          ? "Paketi dondur"
          : kind === "freeze_end"
            ? "Dondurmayı bitir"
            : "Paketi sonlandır",
    }),
  );
  if (kind === "freeze")
    await user.type(screen.getByLabelText("Dondurma başlangıç tarihi"), "2030-02-01");
  if (kind === "freeze_end")
    await user.selectOptions(screen.getByLabelText("Bitirilecek dondurma"), freezeId);
  if (kind !== "terminate")
    await user.type(screen.getByLabelText("Bitiş tarihi (hariç)"), "2030-03-01");
  await user.type(screen.getByLabelText("İşlem gerekçesi"), "Açık kullanıcı isteği");
  await user.click(screen.getByRole("button", { name: "Paket işlemini önizle" }));
  const review = await screen.findByRole("region", { name: "İşlemi incele" });
  return { user, review };
}
test.each(["freeze", "freeze_end", "terminate"] as const)(
  "%s requires a separate native preview approval and rereads rights after apply",
  async (kind) => {
    render(<SaleLifecycle scope={scope} personId={person} onSaved={saved} api={api} read={read} />);
    const { user, review } = await fill(kind);
    expect(send).not.toHaveBeenCalled();
    const summaries = {
      freeze: "İstenen dondurma aralığı: 2030-02-01 — 2030-03-01",
      freeze_end: "İstenen dondurma bitişi: 2030-03-01",
      terminate: "Sonlandırma finansal iade veya nakit ödeme değildir.",
    };
    expect(review).toHaveTextContent(summaries[kind]);
    const call = kind === "freeze" ? api.freeze : kind === "freeze_end" ? api.end : api.terminate;
    expect(call).toHaveBeenCalledOnce();
    expect(call.mock.calls[0][1]).toBe(kind === "freeze_end" ? freezeId : id);
    await user.click(within(review).getByRole("checkbox"));
    await user.click(within(review).getByRole("button", { name: "İşlemi uygula" }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(send.mock.calls[0][0]).toMatchObject({
      operation: kind === "terminate" ? "sale_terminate_apply_v1" : `${kind}_apply_v1`,
      input: { center_id: id, preview: { id, token: "proof" } },
    });
    expect(read).toHaveBeenCalledTimes(2);
  },
);
test("lost lifecycle response survives denied rights reads and remount with exact proof/key", async () => {
  send.mockRejectedValueOnce(Error("response lost"));
  const view = render(
    <SaleLifecycle scope={scope} personId={person} onSaved={saved} api={api} read={read} />,
  );
  const { user, review } = await fill("freeze");
  await user.click(within(review).getByRole("checkbox"));
  await user.click(within(review).getByRole("button", { name: "İşlemi uygula" }));
  await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  const original = send.mock.calls[0][0];
  expect(sessionStorage.getItem(setupStorageKey(scope, `sale-lifecycle:${person}`))).not.toBeNull();
  view.unmount();
  read.mockRejectedValue(Error("FORBIDDEN"));
  render(<SaleLifecycle scope={scope} personId={person} onSaved={saved} api={api} read={read} />);
  await user.click(await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  expect(send.mock.calls[1][0]).toEqual(original);
});
test("foreign person and freeze scope rows cannot become lifecycle sources", async () => {
  read.mockResolvedValue([{ ...row, person_id: id }]);
  render(<SaleLifecycle scope={scope} personId={person} onSaved={saved} api={api} read={read} />);
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("İşlem yapılacak paket")).not.toBeInTheDocument();
});
test("a definite preview rejection discards approval and rereads source state", async () => {
  const { ApiFailure } = await import("../src/lib/api");
  send.mockRejectedValueOnce(
    new ApiFailure({ ok: false, error: { code: "PREVIEW_STALE", retryable: false, trace_id: id } }),
  );
  render(<SaleLifecycle scope={scope} personId={person} onSaved={saved} api={api} read={read} />);
  const { user, review } = await fill("freeze");
  await user.click(within(review).getByRole("checkbox"));
  await user.click(within(review).getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("region", { name: "İşlemi incele" })).not.toBeInTheDocument();
  expect(saved).not.toHaveBeenCalled();
});
