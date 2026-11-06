import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { NegativeValuation } from "../src/components/products/negative-valuation";
import { PendingOperations } from "../src/components/setup/pending-operations";
import type { SetupCommand } from "../src/lib/studio-setup";
const mocks = vi.hoisted(() => ({
  context: vi.fn<typeof import("../src/lib/negative-valuation").valuationApi.context>(),
  read: vi.fn<typeof import("../src/lib/negative-valuation").valuationApi.read>(),
  send: vi.fn<(command: SetupCommand) => Promise<{ primary_id: string }>>(),
}));
vi.mock("../src/lib/negative-valuation", async (load) => ({
  ...(await load<typeof import("../src/lib/negative-valuation")>()),
  valuationApi: { context: mocks.context, read: mocks.read },
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  sendSetupCommand: mocks.send,
}));
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  discipline = "019a2b3c-4d5e-7000-8000-000000000002",
  scope = { actorId: id, orgId: id, centerId: id };
const source: ManagementStateView = {
  operation: "negcredit_valuation_set_v1",
  entity: { type: "centers", id },
  exists: false,
  state: null,
  versions: [{ entity: { type: "centers", id }, version: 7 }],
  as_of: "2030-01-01T00:00:00Z",
  current: { operation: "negcredit_valuation_set_v1", values: {} },
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.context.mockResolvedValue({
    disciplines: [{ id: discipline, name: "Tango", state: "active", version: 1 }],
    timeZone: "Europe/Berlin",
  });
  mocks.read.mockResolvedValue({
    items: [source],
    next_cursor: null,
    as_of: "2030-01-01T00:00:00Z",
  });
  mocks.send.mockResolvedValue({ primary_id: id });
});
async function review() {
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByLabelText("Değerleme disiplini"), discipline);
  await user.selectOptions(screen.getByLabelText("Değerleme ders biçimi"), "group");
  await user.type(await screen.findByLabelText("Birim kredi değeri"), "0");
  await user.type(screen.getByLabelText("Değerleme para birimi"), "TRY");
  fireEvent.change(screen.getByLabelText("Değerleme yürürlük başlangıcı"), {
    target: { value: "2030-02-01T12:00" },
  });
  await user.click(screen.getByRole("button", { name: "Değerlemeyi incele" }));
  return { user, review: screen.getByRole("region", { name: "Değerlemeyi incele" }) };
}
test("publishes explicit zero with the actual center version, selected format and local effective instant", async () => {
  render(<NegativeValuation scope={scope} />);
  const { user, review: panel } = await review();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(within(panel).getByRole("button", { name: "Değerlemeyi yayımla" })).toBeDisabled();
  await user.click(within(panel).getByRole("checkbox"));
  await user.click(within(panel).getByRole("button", { name: "Değerlemeyi yayımla" }));
  await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "negcredit_valuation_set_v1",
    input: {
      expected_version: 7,
      discipline_id: discipline,
      center_id: id,
      format: "group",
      amount_minor: "0",
      currency: "TRY",
      effective_at: "2030-02-01T11:00:00.000Z",
    },
  });
});
test("editing valuation terms discards the reviewed command and approval", async () => {
  render(<NegativeValuation scope={scope} />);
  const { user, review: panel } = await review();
  await user.click(within(panel).getByRole("checkbox"));
  await user.type(screen.getByLabelText("Birim kredi değeri"), "1");
  expect(screen.queryByRole("region", { name: "Değerlemeyi incele" })).not.toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
});
test("valuation recovery remains available in global pending operations after catalog permission loss", async () => {
  mocks.send.mockRejectedValueOnce(Error("lost response"));
  const view = render(<NegativeValuation scope={scope} />);
  const { user, review: panel } = await review();
  await user.click(within(panel).getByRole("checkbox"));
  await user.click(within(panel).getByRole("button", { name: "Değerlemeyi yayımla" }));
  await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  const original = mocks.send.mock.calls[0][0];
  view.unmount();
  mocks.context.mockRejectedValue(Error("FORBIDDEN"));
  render(
    <>
      <NegativeValuation scope={scope} />
      <PendingOperations actorId={id} onSaved={() => {}} />
    </>,
  );
  await user.click(await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
  expect(mocks.send.mock.calls[1][0]).toEqual(original);
});
