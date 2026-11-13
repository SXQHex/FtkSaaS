import "../../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const { list, revoke, read, signout, navigate } = vi.hoisted(() => ({
  list: vi.fn(),
  revoke: vi.fn(),
  read: vi.fn(),
  signout: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("./sessions", () => ({
  readSessions: list,
  revokeSession: revoke,
  saveSessionLabel: vi.fn(),
}));
vi.mock("../../lib/account", () => ({ readAccount: read }));
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({ auth: { signOut: signout } }),
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
