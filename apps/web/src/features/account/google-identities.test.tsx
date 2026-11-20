import "../../i18n";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const { read, link, unlink } = vi.hoisted(() => ({
  read: vi.fn(),
  link: vi.fn(),
  unlink: vi.fn(),
}));
vi.mock("./identities", () => ({ readIdentities: read, linkGoogle: link, unlinkGoogle: unlink }));
import { GoogleIdentities } from "./google-identities";
afterEach(() => vi.resetAllMocks());
const email = {
  identity_id: "email-id",
  id: "email-provider-id",
  user_id: "fixture",
  provider: "email",
};
const google = {
  ...email,
  identity_id: "google-id",
  provider: "google",
  identity_data: { email: "google@example.invalid" },
};
function setup(changed = vi.fn().mockResolvedValue(undefined)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <GoogleIdentities accountId="fixture" onChanged={changed} />
    </QueryClientProvider>,
  );
  return { client, changed };
}
it("never presents a failed identity read as an unlinked Google account", async () => {
  read.mockRejectedValue(new Error("network"));
  setup();
  expect(
    await screen.findByText("Bağlı giriş yöntemleri okunamadı.", { exact: false }),
  ).toBeVisible();
  expect(screen.queryByText("Bağlı değil")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Google ile bağla" })).not.toBeInTheDocument();
});
it("retries a failed link initiation through native link, retaining the explicit action", async () => {
  read.mockResolvedValue([email]);
  link.mockRejectedValueOnce(new Error("native")).mockResolvedValueOnce(undefined);
  setup();
  await userEvent.click(await screen.findByRole("button", { name: "Google ile bağla" }));
  await screen.findByText("Google hesabı bağlama başlatılamadı.", { exact: false });
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  expect(link).toHaveBeenCalledTimes(2);
  expect(unlink).not.toHaveBeenCalled();
});
it("requires selected Google confirmation and retries only the read after known removal", async () => {
  read.mockResolvedValueOnce([email, google]).mockRejectedValueOnce(new Error("read"));
  unlink.mockResolvedValue(undefined);
  const { changed } = setup();
  await userEvent.click(await screen.findByRole("button", { name: "Bağlantıyı kaldır" }));
  await userEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
  expect(unlink).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Bağlantıyı kaldır" }));
  await userEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Google bağlantısını kaldır" }),
  );
  await screen.findByText("Bağlı giriş yöntemleri okunamadı.", { exact: false });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(unlink).toHaveBeenCalledExactlyOnceWith(google);
  expect(screen.queryByText("Bağlı", { exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Google ile bağla" })).toBeDisabled();
  expect(changed).toHaveBeenCalledOnce();
  read.mockResolvedValue([email]);
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  await screen.findByRole("button", { name: "Google ile bağla" });
  expect(unlink).toHaveBeenCalledOnce();
});
it("preserves a native unlink denial and blocks removing the last native identity", async () => {
  read.mockResolvedValue([email, google]);
  unlink.mockRejectedValue(new Error("native"));
  const { client } = setup();
  await userEvent.click(await screen.findByRole("button", { name: "Bağlantıyı kaldır" }));
  await userEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Google bağlantısını kaldır" }),
  );
  await screen.findByText("Bağlantı kaldırma doğrulanamadı.", { exact: false });
  expect(screen.getByRole("dialog")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
  read.mockResolvedValue([google]);
  await client.invalidateQueries({ queryKey: ["account-identities", "fixture"] });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Bağlantıyı kaldır" })).toBeDisabled(),
  );
  expect(unlink).toHaveBeenCalledOnce();
});
