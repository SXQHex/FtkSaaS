import "../../i18n";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { fresh, getSession, signOut, context, navigate, invalidate } = vi.hoisted(() => ({
  fresh: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  context: vi.fn(),
  navigate: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("./fresh-session", async (original) => ({
  ...(await original<typeof import("./fresh-session")>()),
  freshPasswordSession: fresh,
}));
vi.mock("./deletion", () => ({ deletionContext: context }));
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({ auth: { getSession, signOut } }),
}));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ navigate, invalidate }) }));
import { DeletionConfirmation } from "./deletion-confirmation";
import { MfaRequiredError } from "./fresh-session";
let actor: string;
beforeEach(() => {
  actor = "actor-a";
  getSession.mockImplementation(async () => ({
    data: { session: { user: { id: actor }, access_token: `proof-${actor}` } },
    error: null,
  }));
  context.mockResolvedValue({ owned: false });
  fresh.mockResolvedValue(undefined);
});
afterEach(() => vi.resetAllMocks());
function mount(confirm = vi.fn().mockResolvedValue(undefined)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const onPending = vi.fn();
  const rendered = render(
    <QueryClientProvider client={client}>
      <DeletionConfirmation confirm={confirm} onPending={onPending} />
    </QueryClientProvider>,
  );
  return { ...rendered, client, confirm, onPending };
}
async function submit() {
  await userEvent.type(screen.getByLabelText("Onaylamak için SİL yaz"), "SİL");
  await userEvent.type(screen.getByLabelText("Parola", { exact: true }), "fixture-password");
  await userEvent.click(screen.getByRole("button", { name: "Hesabı sil" }));
}
it("routes an AAL downgrade to MFA and clears protected cached data", async () => {
  const confirm = vi.fn().mockRejectedValue(new MfaRequiredError());
  const { client } = mount(confirm);
  client.setQueryData(["private"], "secret fixture");
  await submit();
  await waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/mfa" }));
  expect(client.getQueryData(["private"])).toBeUndefined();
  expect(invalidate).toHaveBeenCalledOnce();
  expect(signOut).not.toHaveBeenCalled();
  client.clear();
});
it("never applies if reauthentication has changed the native actor", async () => {
  fresh.mockImplementation(async () => {
    actor = "actor-b";
  });
  const { confirm, client, onPending } = mount();
  await submit();
  await waitFor(() => expect(onPending).toHaveBeenLastCalledWith(false));
  expect(confirm).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  client.clear();
});
it("does not sign out or navigate a changed actor when an old apply ACK returns", async () => {
  let finish!: () => void;
  const confirm = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { client, onPending } = mount(confirm);
  await submit();
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  actor = "actor-b";
  await act(async () => finish());
  await waitFor(() => expect(onPending).toHaveBeenLastCalledWith(false));
  expect(signOut).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  expect(context).not.toHaveBeenCalled();
  client.clear();
});
it("ignores completion side effects after the confirmation view unmounts", async () => {
  let finish!: () => void;
  const confirm = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { client, unmount, onPending } = mount(confirm);
  await submit();
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  const count = getSession.mock.calls.length;
  unmount();
  await act(async () => finish());
  expect(getSession).toHaveBeenCalledTimes(count);
  expect(signOut).not.toHaveBeenCalled();
  expect(onPending).toHaveBeenCalledExactlyOnceWith(true);
  client.clear();
});
