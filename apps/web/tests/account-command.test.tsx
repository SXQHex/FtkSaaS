import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { ProfileForm } from "../src/components/account/profile-form";
import {
  recoverAccountCommand,
  accountStorageKey,
  useAccountCommand,
  CommandFeedback,
} from "../src/components/account/account-command";
import { ApiFailure } from "../src/lib/api";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
  saved: vi.fn<() => number>(() => 1),
  signOut: vi.fn<() => Promise<{ error: null }>>(),
}));
vi.mock("../src/lib/account", async (load) => ({
  ...(await load<typeof import("../src/lib/account")>()),
  accountCall: mocks.call,
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({ auth: { signOut: mocks.signOut } }),
}));
const actor = "019a2b3c-4d5e-7000-8000-000000000001";
const profile = { id: actor, state: "active" as const, display_name: "Synthetic Person" };
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});
test("profile uncertainty survives remount and retries the exact saved payload and key", async () => {
  mocks.call
    .mockRejectedValueOnce(new Error("lost response"))
    .mockResolvedValueOnce({ primary_id: actor });
  const user = userEvent.setup();
  const view = render(
    <ProfileForm readRevision={0} account={profile} version={7} onSaved={mocks.saved} />,
  );
  await user.clear(screen.getByLabelText("Görünen ad"));
  await user.type(screen.getByLabelText("Görünen ad"), "Updated Person");
  await user.click(screen.getByRole("button", { name: "Profili kaydet" }));
  expect(
    await screen.findByText(
      "Sonuç belirsiz. Yeni işlem başlatma; aynı işlemin sonucunu kontrol et.",
    ),
  ).toBeVisible();
  expect(screen.getByLabelText("Görünen ad")).toBeDisabled();
  const original = mocks.call.mock.calls[0];
  view.unmount();
  render(<ProfileForm readRevision={0} account={profile} version={9} onSaved={mocks.saved} />);
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  expect(mocks.call.mock.calls[1]).toEqual(original);
  expect(mocks.call.mock.calls[1][1].expected_version).toBe(7);
  expect(mocks.saved).toHaveBeenCalledOnce();
  expect(sessionStorage.getItem(accountStorageKey(actor, "profile"))).toBeNull();
});
test("later forbidden or NOT_FOUND does not discard an uncertain mutation", async () => {
  mocks.call.mockRejectedValueOnce(new Error("lost"));
  const user = userEvent.setup();
  render(<ProfileForm readRevision={0} account={profile} version={1} onSaved={mocks.saved} />);
  await user.click(screen.getByRole("button", { name: "Profili kaydet" }));
  await screen.findByText(/Sonuç belirsiz/);
  mocks.call.mockRejectedValue(
    new ApiFailure({ ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: actor } }),
  );
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(mocks.call).toHaveBeenCalledTimes(2));
  await user.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  expect(sessionStorage.getItem(accountStorageKey(actor, "profile"))).not.toBeNull();
  expect(mocks.saved).not.toHaveBeenCalled();
});
test("expired result disables replay across remounts even after NOT_FOUND", async () => {
  mocks.call.mockRejectedValue(
    new ApiFailure({
      ok: false,
      error: { code: "OPERATION_RESULT_EXPIRED", retryable: false, trace_id: actor },
    }),
  );
  const user = userEvent.setup();
  const view = render(
    <ProfileForm readRevision={0} account={profile} version={1} onSaved={mocks.saved} />,
  );
  await user.click(screen.getByRole("button", { name: "Profili kaydet" }));
  await screen.findByText(/Sonuç belirsiz/);
  view.unmount();
  render(<ProfileForm readRevision={0} account={profile} version={1} onSaved={mocks.saved} />);
  expect(
    screen.queryByRole("button", { name: "Aynı işlemi yeniden gönder" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Profili kaydet" })).toBeDisabled();
});
test("storage failure prevents sending a new profile mutation", async () => {
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("full");
  });
  try {
    const user = userEvent.setup();
    render(<ProfileForm readRevision={0} account={profile} version={1} onSaved={mocks.saved} />);
    await user.click(screen.getByRole("button", { name: "Profili kaydet" }));
    expect(mocks.call).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Güvenli işlem takibi");
  } finally {
    storage.mockRestore();
  }
});
test("recovery rejects proof fields, other operations, malformed records and separates actors", () => {
  const key = accountStorageKey(actor, "profile");
  sessionStorage.setItem(
    key,
    JSON.stringify({
      command: {
        operation: "account_profile_update_v1",
        input: {
          operation_key: actor,
          expected_version: 1,
          display_name: "Test",
          reauth: "must-not-leak",
        },
      },
    }),
  );
  expect(recoverAccountCommand(actor, "profile")).toBe("invalid");
  expect(recoverAccountCommand("different-account", "profile")).toBeNull();
  sessionStorage.setItem(key, "not-json");
  expect(recoverAccountCommand(actor, "profile")).toBe("invalid");
});

function CurrentSessionRecovery() {
  const command = useAccountCommand(actor, "current-session", mocks.saved);
  return <CommandFeedback command={command} />;
}
test("status-confirmed current-session revocation also clears the native local session", async () => {
  sessionStorage.setItem(
    accountStorageKey(actor, "current-session"),
    JSON.stringify({
      command: {
        operation: "account_sessions_revoke_v1",
        input: { operation_key: actor, mode: "current" },
      },
    }),
  );
  mocks.call.mockResolvedValue({ status: "succeeded", result_reference: null });
  mocks.signOut.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(<CurrentSessionRecovery />);
  await user.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" }));
  expect(mocks.call).toHaveBeenCalledExactlyOnceWith("operation_status_get_v1", {
    operation: "account_sessions_revoke_v1",
    key: actor,
  });
});
