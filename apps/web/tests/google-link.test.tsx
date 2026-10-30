import { useEffect } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { GoogleLink } from "../src/components/account/google-link";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
  proof: vi.fn<() => Promise<string>>(),
  nativeLink: vi.fn<() => Promise<{ error: Error | null }>>(),
  callback: null as null | ((result: { credential: string }) => void),
  initialize: vi.fn<(options: { callback: (result: { credential: string }) => void }) => void>(),
  cancel: vi.fn<() => void>(),
}));
vi.mock("../src/lib/account", async (load) => ({
  ...(await load<typeof import("../src/lib/account")>()),
  accountCall: mocks.call,
  freshAccountProof: mocks.proof,
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({ auth: { linkIdentity: mocks.nativeLink } }),
}));
vi.mock("next/script", () => ({
  default: function ProviderScript({ onReady }: { onReady: () => void }) {
    useEffect(onReady, [onReady]);
    return null;
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "synthetic-client");
  mocks.callback = null;
  mocks.proof.mockResolvedValue("synthetic-fresh-proof");
  mocks.initialize.mockImplementation((options) => {
    mocks.callback = options.callback;
  });
  vi.stubGlobal("google", {
    accounts: {
      id: { initialize: mocks.initialize, renderButton: () => {}, cancel: mocks.cancel },
    },
  });
});
test("Google linking obtains backend approval before native ID-token linking and uses the same token", async () => {
  const order: string[] = [];
  mocks.call.mockImplementation(async (operation) => {
    order.push(operation);
    return operation === "account_get_v1" ? { id: "actor" } : { status: "ready" };
  });
  mocks.nativeLink.mockImplementation(async () => {
    order.push("native-link");
    return { error: null };
  });
  const user = userEvent.setup();
  render(<GoogleLink actorId="actor" />);
  await user.click(await screen.findByRole("button", { name: "Doğrula ve Google hesabını seç" }));
  await waitFor(() => expect(mocks.callback).not.toBeNull());
  await act(async () => {
    mocks.callback!({ credential: "synthetic-google-token" });
  });
  expect(await screen.findByRole("status")).toHaveTextContent("bağlandı");
  expect(order).toEqual(["account_get_v1", "account_google_link_prepare_v1", "native-link"]);
  expect(mocks.call).toHaveBeenLastCalledWith("account_google_link_prepare_v1", {
    reauth: "synthetic-fresh-proof",
    google_id_token: "synthetic-google-token",
  });
  expect(mocks.nativeLink).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: "google",
      token: "synthetic-google-token",
      nonce: expect.any(String),
    }),
  );
});
test("backend approval failure never attempts native linking or reports success", async () => {
  mocks.call.mockImplementation(async (operation) => {
    if (operation === "account_get_v1") return { id: "actor" };
    throw new Error("approval denied");
  });
  const user = userEvent.setup();
  render(<GoogleLink actorId="actor" />);
  await user.click(await screen.findByRole("button", { name: "Doğrula ve Google hesabını seç" }));
  await waitFor(() => expect(mocks.callback).not.toBeNull());
  await act(async () => {
    mocks.callback!({ credential: "synthetic-google-token" });
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("Kimlik sağlayıcısı");
  expect(mocks.nativeLink).not.toHaveBeenCalled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
test("missing Google client configuration does not expose a nonfunctional linking button", () => {
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
  render(<GoogleLink actorId="actor" />);
  expect(screen.getByText(/web istemci yapılandırması gerekiyor/)).toBeVisible();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
