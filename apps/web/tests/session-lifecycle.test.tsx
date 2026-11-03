import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { SessionCancellation } from "../src/components/calendar/session-cancellation";
const mocks = vi.hoisted(() => ({
  call: vi.fn<typeof import("../src/lib/studio-setup").setupCall>(),
  send: vi.fn<typeof import("../src/lib/studio-setup").sendSetupCommand>(),
  saved: vi.fn<() => void>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: mocks.call,
  sendSetupCommand: mocks.send,
}));
const scope = {
  actorId: "actor",
  orgId: "019a2b3c-4d5e-7000-8000-000000000001",
  centerId: "019a2b3c-4d5e-7000-8000-000000000002",
};
const sessionId = "019a2b3c-4d5e-7000-8000-000000000003";
const preview: import("@ftksaas/api-contracts").Preview = {
  id: "019a2b3c-4d5e-7000-8000-000000000004",
  token: "preview-token",
  scope_hash: "scope",
  dependencies: { versions: [], policy_hashes: [], permission_hash: "permission" },
  effects: [
    {
      entity: { type: "reservations", id: "reservation" },
      action: "cancel",
      reason: "Salon kapalı",
    },
    {
      entity: { type: "entitlement_allocations", id: "allocation" },
      action: "release",
      quantity: 1,
      reason: "Hak iadesi",
    },
  ],
  blockers: [],
  expires_at: "2099-01-01T00:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.call.mockResolvedValue(preview);
  mocks.send.mockResolvedValue({
    operation_id: "op",
    primary_id: sessionId,
    version: 2,
    replayed: false,
    related: [],
  });
});
async function prepare() {
  render(
    <SessionCancellation
      scope={scope}
      sessionId={sessionId}
      timeZone="Europe/Istanbul"
      onSaved={mocks.saved}
    />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("İptal gerekçesi"), "Salon kapalı");
  await user.click(screen.getByRole("button", { name: "İptal etkilerini önizle" }));
  await screen.findByRole("heading", { name: "İptal etkileri" });
  return user;
}
test("cancellation requires effect confirmation and applies only the returned preview", async () => {
  const user = await prepare();
  expect(screen.getByText("Hak iadesi")).toBeVisible();
  expect(mocks.send).not.toHaveBeenCalled();
  const apply = screen.getByRole("button", { name: "Onayla ve seansı iptal et" });
  expect(apply).toBeDisabled();
  await user.click(screen.getByLabelText("Gösterilen iptal etkilerini onaylıyorum"));
  await user.click(apply);
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.call).toHaveBeenCalledWith("session_cancel_preview_v1", {
    org_id: scope.orgId,
    center_id: scope.centerId,
    session_id: sessionId,
    reason: "Salon kapalı",
  });
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "session_cancel_apply_v1",
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      preview: { id: preview.id, token: preview.token },
    },
  });
});
test("blocked and expired cancellation previews cannot apply", async () => {
  mocks.call.mockResolvedValue({
    ...preview,
    expires_at: "2000-01-01T00:00:00Z",
    blockers: [{ code: "OPEN_OPERATIONS_EXIST", retryable: false, trace_id: "trace" }],
  });
  await prepare();
  expect(screen.getByRole("button", { name: "Onayla ve seansı iptal et" })).toBeDisabled();
  expect(mocks.send).not.toHaveBeenCalled();
});
test("uncertain cancellation survives remount with the identical approved command", async () => {
  const { setupStorageKey } = await import("../src/lib/studio-setup");
  const command = {
    operation: "session_cancel_apply_v1",
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: "019a2b3c-4d5e-7000-8000-000000000005",
      preview: { id: preview.id, token: preview.token },
    },
  };
  sessionStorage.setItem(
    setupStorageKey(scope, `cancel:${sessionId}`),
    JSON.stringify({ command }),
  );
  render(
    <SessionCancellation
      scope={scope}
      sessionId={sessionId}
      timeZone="Europe/Istanbul"
      onSaved={mocks.saved}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.send).toHaveBeenCalledWith(command);
});

test("a lost cancellation response recovers after the editor closes and catalog access fails", async () => {
  mocks.send.mockRejectedValueOnce(Error("response lost"));
  const view = render(
    <SessionCancellation
      scope={scope}
      sessionId={sessionId}
      timeZone="Europe/Istanbul"
      onSaved={mocks.saved}
    />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("İptal gerekçesi"), "Salon kapalı");
  await user.click(screen.getByRole("button", { name: "İptal etkilerini önizle" }));
  await screen.findByRole("heading", { name: "İptal etkileri" });
  await user.click(screen.getByLabelText("Gösterilen iptal etkilerini onaylıyorum"));
  await user.click(screen.getByRole("button", { name: "Onayla ve seansı iptal et" }));
  await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  const approved = mocks.send.mock.calls[0][0];
  view.unmount();
  mocks.call.mockRejectedValue(Error("forbidden"));
  mocks.send.mockResolvedValue({
    operation_id: "op",
    primary_id: sessionId,
    version: 2,
    replayed: true,
    related: [],
  });
  const { ProgramRecovery } = await import("../src/components/programs/program-recovery");
  render(<ProgramRecovery scope={scope} onSaved={mocks.saved} />);
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[1][0]).toEqual(approved);
});
