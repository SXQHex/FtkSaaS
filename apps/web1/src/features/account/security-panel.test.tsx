import "../../i18n";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const { factors, history, enroll, remove, refreshNative, account, password, sessions } = vi.hoisted(
  () => ({
    factors: vi.fn(),
    history: vi.fn(),
    enroll: vi.fn(),
    remove: vi.fn(),
    refreshNative: vi.fn(),
    account: vi.fn(),
    password: vi.fn(),
    sessions: vi.fn(),
  }),
);
vi.mock("./security", () => ({
  readFactors: factors,
  readSecurityHistory: history,
  enrollTotp: enroll,
  confirmTotpSetup: vi.fn(),
  removeTotpFactor: remove,
}));
vi.mock("../../lib/account", () => ({ readAccount: account }));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ invalidate: vi.fn() }) }));
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({ auth: { refreshSession: refreshNative } }),
}));
vi.mock("./password", () => ({ changePassword: password, requestPasswordCode: vi.fn() }));
vi.mock("./sessions", () => ({ readSessions: sessions }));
import { SecurityPanel } from "./security-panel";
afterEach(() => vi.resetAllMocks());
it("keeps an active setup sheet when background factor rereads discover its pending factor or fail", async () => {
  factors.mockResolvedValue({ all: [], totp: [] });
  history.mockResolvedValue({ items: [], next_cursor: null });
  enroll.mockResolvedValue({
    id: "pending",
    type: "totp",
    totp: { secret: "SYNTHETIC-KEY", qr_code: "data:image/svg+xml,synthetic" },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <SecurityPanel accountId="fixture" />
    </QueryClientProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Kur" }));
  await screen.findByText("SYNTHETIC-KEY");
  factors.mockResolvedValue({
    all: [{ id: "pending", factor_type: "totp", status: "unverified" }],
    totp: [],
  });
  await act(() => client.invalidateQueries({ queryKey: ["account-factors", "fixture"] }));
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByText("SYNTHETIC-KEY")).toBeVisible();
  factors.mockRejectedValue(new Error("temporary-network"));
  await act(() => client.invalidateQueries({ queryKey: ["account-factors", "fixture"] }));
  await waitFor(() => expect(factors).toHaveBeenCalledTimes(3));
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByLabelText("Uygulamadaki 6 haneli kod")).toBeVisible();
  expect(enroll).toHaveBeenCalledOnce();
  client.clear();
});

it("awaits native refresh before dependent reads and preserves refresh intent after failure", async () => {
  const factor = {
    id: "selected",
    status: "verified",
    factor_type: "totp",
    friendly_name: "Fixture app",
  };
  factors.mockResolvedValue({ all: [factor], totp: [factor] });
  history.mockResolvedValue({ items: [], next_cursor: null });
  remove.mockResolvedValue(undefined);
  let finish: ((result: { error: null }) => void) | undefined;
  refreshNative.mockResolvedValueOnce({ error: new Error("network") }).mockImplementationOnce(
    () =>
      new Promise<{ error: null }>((resolve) => {
        finish = resolve;
      }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <SecurityPanel accountId="fixture" />
    </QueryClientProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Kaldır" }));
  await userEvent.click(screen.getByRole("button", { name: "Uygulamayı kaldır" }));
  await screen.findByText("İşlem sonrasında güvenlik bilgileri yenilenemedi.");
  expect(account).not.toHaveBeenCalled();
  expect(factors).toHaveBeenCalledOnce();
  expect(history).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  expect(refreshNative).toHaveBeenCalledTimes(2);
  expect(account).not.toHaveBeenCalled();
  expect(factors).toHaveBeenCalledOnce();
  expect(history).toHaveBeenCalledOnce();
  await act(async () => {
    finish?.({ error: null });
  });
  await waitFor(() => expect(account).toHaveBeenCalledOnce());
  expect(factors).toHaveBeenCalledTimes(2);
  expect(history).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenCalledOnce();
  client.clear();
});

it("keeps password success separate from session reread failure and retries only reads", async () => {
  factors.mockResolvedValue({ all: [], totp: [] });
  history.mockResolvedValue({ items: [], next_cursor: null });
  password.mockResolvedValue(undefined);
  sessions
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({ items: [], next_cursor: null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  client.setQueryData(["account-sessions", "fixture"], { stale: true });
  render(
    <QueryClientProvider client={client}>
      <SecurityPanel accountId="fixture" />
    </QueryClientProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Parolayı değiştir" }));
  await userEvent.type(screen.getByLabelText("Mevcut parola"), "current-password");
  await userEvent.type(screen.getByLabelText("Yeni parola", { exact: true }), "new-password");
  await userEvent.type(screen.getByLabelText("Yeni parola tekrar"), "new-password");
  const buttons = screen.getAllByRole("button", { name: "Parolayı değiştir" });
  await userEvent.click(buttons[buttons.length - 1]);
  await screen.findByText("İşlem sonrasında güvenlik bilgileri yenilenemedi.");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(client.getQueryData(["account-sessions", "fixture"])).toBeUndefined();
  expect(password).toHaveBeenCalledOnce();
  expect(sessions).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  await waitFor(() => expect(sessions).toHaveBeenCalledTimes(2));
  expect(password).toHaveBeenCalledOnce();
  await waitFor(() =>
    expect(
      screen.queryByText("İşlem sonrasında güvenlik bilgileri yenilenemedi."),
    ).not.toBeInTheDocument(),
  );
  expect(account).toHaveBeenCalledTimes(2);
  client.clear();
});
