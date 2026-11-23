import "../../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const { list, revoke, saveLabel, read, signout, navigate, getSession } = vi.hoisted(() => ({
  list: vi.fn(),
  revoke: vi.fn(),
  saveLabel: vi.fn(),
  read: vi.fn(),
  signout: vi.fn(),
  navigate: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("./sessions", () => ({
  readSessions: list,
  revokeSession: revoke,
  saveSessionLabel: saveLabel,
}));
vi.mock("../../lib/account", () => ({ readAccount: read }));
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({ auth: { signOut: signout, getSession } }),
}));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ navigate, invalidate: vi.fn() }) }));
import { SessionsPanel } from "./sessions-panel";
afterEach(() => vi.resetAllMocks());
it("closes the local UI and cache without further protected reads if the backend reports this session revoked", async () => {
  list.mockResolvedValue({
    items: [
      {
        session_id: "550e8400-e29b-41d4-a716-446655440000",
        current: false,
        created_at: "2026-11-13T00:00:00Z",
        last_refreshed_at: "2026-11-13T00:00:00Z",
        user_agent: "Fixture",
        label: null,
        version: 0,
      },
    ],
    next_cursor: null,
  });
  revoke.mockResolvedValue({ current_revoked: true });
  signout.mockResolvedValue({ error: new Error("already-revoked") });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  client.setQueryData(["private-fixture"], { value: "cached" });
  render(
    <QueryClientProvider client={client}>
      <SessionsPanel accountId="fixture" />
    </QueryClientProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Oturumu kapat" }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/login", replace: true }),
  );
  expect(signout).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  expect(read).not.toHaveBeenCalled();
  expect(client.getQueryData(["private-fixture"])).toBeUndefined();
  client.clear();
});

it("reads only the new first page after closing a session and continues with its new cursor", async () => {
  const firstId = "550e8400-e29b-41d4-a716-446655440000";
  const secondId = "550e8400-e29b-41d4-a716-446655440001";
  const currentId = "550e8400-e29b-41d4-a716-446655440002";
  const row = (id: string, label: string, current = false) => ({
    session_id: id,
    label,
    current,
    created_at: "2026-11-13T00:00:00Z",
    last_refreshed_at: "2026-11-13T00:00:00Z",
    user_agent: null,
    version: 1,
  });
  let closed = false;
  list.mockImplementation(async (cursor?: string) => {
    if (cursor === "old-next" && !closed)
      return { items: [row(secondId, "Eski devam kaydı")], next_cursor: null };
    if (cursor === "new-next")
      return { items: [row(secondId, "Yeni devam kaydı")], next_cursor: null };
    if (cursor) throw new Error("UNEXPECTED_CURSOR");
    return closed
      ? { items: [row(currentId, "Güncel oturum", true)], next_cursor: "new-next" }
      : { items: [row(firstId, "Kapatılacak oturum")], next_cursor: "old-next" };
  });
  revoke.mockImplementation(async () => {
    closed = true;
    return { current_revoked: false };
  });
  getSession.mockResolvedValue({
    data: { session: { user: { id: "native-fixture" }, access_token: "native-fixture" } },
    error: null,
  });
  read.mockResolvedValue({ id: "fixture" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <SessionsPanel accountId="fixture" />
    </QueryClientProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Daha fazla" }));
  expect(await screen.findByText("Eski devam kaydı")).toBeVisible();
  await userEvent.click(screen.getAllByRole("button", { name: "Oturumu kapat" })[0]);
  expect(await screen.findByText("Oturum bilgileri yenilendi.")).toBeVisible();
  expect(screen.queryByText("Eski devam kaydı")).not.toBeInTheDocument();
  expect(list.mock.calls.map(([cursor]) => cursor)).toEqual([undefined, "old-next", undefined]);
  await userEvent.click(screen.getByRole("button", { name: "Daha fazla" }));
  expect(await screen.findByText("Yeni devam kaydı")).toBeVisible();
  expect(list.mock.calls.map(([cursor]) => cursor)).toEqual([
    undefined,
    "old-next",
    undefined,
    "new-next",
  ]);
  expect(revoke).toHaveBeenCalledExactlyOnceWith(firstId, expect.any(String));
  view.unmount();
  client.clear();
});

it("keeps the edited session visible using the newly read cursor", async () => {
  const current = {
    session_id: "550e8400-e29b-41d4-a716-446655440000",
    current: true,
    created_at: "2026-11-13T00:00:00Z",
    last_refreshed_at: "2026-11-13T00:00:00Z",
    user_agent: null,
    label: "Bilgisayar",
    version: 1,
  };
  const edited = {
    ...current,
    session_id: "550e8400-e29b-41d4-a716-446655440001",
    current: false,
    label: "Telefon",
  };
  let saved = false;
  list.mockImplementation(async (cursor?: string) => {
    if (!cursor) return { items: [current], next_cursor: saved ? "new-next" : "old-next" };
    if (cursor !== (saved ? "new-next" : "old-next")) throw new Error("UNEXPECTED_CURSOR");
    return {
      items: [saved ? { ...edited, label: "Yeni telefon", version: 2 } : edited],
      next_cursor: null,
    };
  });
  saveLabel.mockImplementation(async () => {
    saved = true;
    return { version: 2 };
  });
  getSession.mockResolvedValue({
    data: { session: { user: { id: "native-fixture" }, access_token: "native-fixture" } },
    error: null,
  });
  read.mockResolvedValue({ id: "fixture" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <SessionsPanel accountId="fixture" />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Daha fazla" }));
  await user.click(await screen.findByRole("button", { name: "Telefon etiketini düzenle" }));
  const label = screen.getByRole("textbox", { name: "Oturum etiketi" });
  await user.clear(label);
  await user.type(label, "Yeni telefon");
  await user.click(screen.getByRole("button", { name: "Kaydet" }));
  expect(await screen.findByText("Yeni telefon")).toBeVisible();
  expect(list.mock.calls.map(([cursor]) => cursor)).toEqual([
    undefined,
    "old-next",
    undefined,
    "new-next",
  ]);
  expect(saveLabel).toHaveBeenCalledExactlyOnceWith({
    sessionId: edited.session_id,
    version: 1,
    label: "Yeni telefon",
    operationKey: expect.any(String),
  });
  view.unmount();
  client.clear();
});
