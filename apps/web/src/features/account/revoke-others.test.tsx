import "../../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const { fresh, prepare, revoke, navigate, invalidate } = vi.hoisted(() => ({
  fresh: vi.fn(),
  prepare: vi.fn(),
  revoke: vi.fn(),
  navigate: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("./fresh-session", async (original) => {
  const actual = await original<typeof import("./fresh-session")>();
  return {
    ...actual,
    freshPasswordSession: fresh,
    prepareOthersIntent: prepare,
    revokeOthers: revoke,
  };
});
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ navigate, invalidate }) }));
import { BackendError } from "../../lib/backend";
import { MfaRequiredError } from "./fresh-session";
import { RevokeOthers } from "./revoke-others";
afterEach(() => vi.resetAllMocks());
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={client}>
      <RevokeOthers onRefresh={refresh} />
    </QueryClientProvider>,
  );
  return { client, refresh };
}
async function open() {
  await userEvent.click(screen.getByRole("button", { name: "Diğerlerini kapat" }));
}
it("requires explicit confirmation after a fresh native sign-in", async () => {
  fresh.mockResolvedValue(undefined);
  prepare.mockResolvedValue({ proof: "synthetic", operationKey: "intent" });
  revoke.mockResolvedValue({ current_revoked: false });
  const { client, refresh } = mount();
  await open();
  await userEvent.type(screen.getByLabelText("Parola"), "fixture-password");
  await userEvent.click(screen.getByRole("button", { name: "Devam et" }));
  expect(
    await screen.findByText(
      "Diğer açık oturumlar kapanacak. Doğruladığın mevcut oturum korunacak.",
    ),
  ).toBeVisible();
  expect(screen.queryByLabelText("Parola")).not.toBeInTheDocument();
  expect(fresh).toHaveBeenCalledExactlyOnceWith("fixture-password");
  expect(revoke).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Diğer oturumları kapat" }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  expect(revoke).toHaveBeenCalledExactlyOnceWith({ proof: "synthetic", operationKey: "intent" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  client.clear();
});
it("invalidates protected state after a native authentication failure without revoking anything", async () => {
  fresh.mockRejectedValue(new Error("denied"));
  const { client } = mount();
  client.setQueryData(["private"], "cached");
  await open();
  await userEvent.type(screen.getByLabelText("Parola"), "wrong");
  await userEvent.click(screen.getByRole("button", { name: "Devam et" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  await waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
  expect(client.getQueryData(["private"])).toBeUndefined();
  expect(prepare).not.toHaveBeenCalled();
  expect(revoke).not.toHaveBeenCalled();
  client.clear();
});
it("uses the canonical MFA route and clears cached state before further protected actions", async () => {
  prepare.mockRejectedValue(new MfaRequiredError());
  const { client } = mount();
  client.setQueryData(["private"], "cached");
  await open();
  await userEvent.click(screen.getByRole("button", { name: "Yeni giriş yaptım" }));
  await waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/mfa" }));
  expect(client.getQueryData(["private"])).toBeUndefined();
  expect(revoke).not.toHaveBeenCalled();
  client.clear();
});
it("retains the same in-memory proof and intent for an uncertain retry", async () => {
  const intent = { proof: "synthetic", operationKey: "same-intent" };
  prepare.mockResolvedValue(intent);
  revoke
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({ current_revoked: false });
  const { client } = mount();
  await open();
  await userEvent.click(screen.getByRole("button", { name: "Yeni giriş yaptım" }));
  await userEvent.click(await screen.findByRole("button", { name: "Diğer oturumları kapat" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Diğer oturumları kapat" }));
  await waitFor(() => expect(revoke).toHaveBeenCalledTimes(2));
  expect(revoke.mock.calls[0][0]).toBe(intent);
  expect(revoke.mock.calls[1][0]).toBe(intent);
  client.clear();
});
it("discards an expired proof and requires a new native confirmation", async () => {
  prepare.mockResolvedValue({ proof: "synthetic", operationKey: "intent" });
  revoke.mockRejectedValue(
    new BackendError({
      code: "AUTH_REQUIRED",
      retryable: false,
      trace_id: "019a7b00-0000-7000-8000-000000000001",
    }),
  );
  const { client } = mount();
  await open();
  await userEvent.click(screen.getByRole("button", { name: "Yeni giriş yaptım" }));
  await userEvent.click(await screen.findByRole("button", { name: "Diğer oturumları kapat" }));
  expect(
    await screen.findByText("Oturum doğrulaması yenilenmeli. Yeniden giriş yapıp tekrar onayla."),
  ).toBeVisible();
  expect(screen.getByLabelText("Parola")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Diğer oturumları kapat" })).not.toBeInTheDocument();
  expect(invalidate).toHaveBeenCalledOnce();
  expect(revoke).toHaveBeenCalledOnce();
  client.clear();
});
