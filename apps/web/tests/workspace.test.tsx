import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { AccountView, CenterView, OrganizationView } from "@ftksaas/api-contracts";
import { Workspace } from "../src/components/workspace";
const mocks = vi.hoisted(() => ({ account: vi.fn(), organizations: vi.fn(), settings: vi.fn(), centers: vi.fn(), replace: vi.fn(), refresh: vi.fn(), setTheme: vi.fn(), unsubscribe: vi.fn() }));
const router = { replace: mocks.replace, refresh: mocks.refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "system", setTheme: mocks.setTheme }) }));
vi.mock("../src/lib/api", () => ({ getAccount: mocks.account, getOrganizations: mocks.organizations, getUserSettings: mocks.settings, getCenters: mocks.centers, ApiFailure: class extends Error {}, errorMessage: () => "Bağlantı kurulamadı." }));
vi.mock("../src/lib/supabase/client", () => ({ browserClient: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: mocks.unsubscribe } } }) } }) }));
const account: AccountView = { id: "019a2b3c-4d5e-7000-8000-000000000001", state: "active", display_name: "Test Yöneticisi" };
const organizations: OrganizationView[] = [
  { id: "019a2b3c-4d5e-7000-8000-000000000002", name: "Kuruluş A", state: "active", access_mode: "normal", version: 1 },
  { id: "019a2b3c-4d5e-7000-8000-000000000003", name: "Kuruluş B", state: "active", access_mode: "normal", version: 1 },
];
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mocks.account.mockResolvedValue(account); mocks.organizations.mockResolvedValue(organizations); mocks.settings.mockResolvedValue({ remember_context: false });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
test("a late response from the previous organization cannot populate the next organization's center selector", async () => {
  let resolveA!: (items: CenterView[]) => void;
  let resolveB!: (items: CenterView[]) => void;
  mocks.centers.mockImplementation((id: string) => new Promise<CenterView[]>(resolve => { if (id === organizations[0].id) resolveA = resolve; else resolveB = resolve; }));
  const user = userEvent.setup(); render(<Workspace />);
  await screen.findByRole("heading", { name: "Merhaba, Test Yöneticisi" });
  await user.click(screen.getByRole("combobox", { name: "Kuruluş seç" })); await user.click(screen.getByRole("option", { name: "Kuruluş A" }));
  await waitFor(() => expect(mocks.centers).toHaveBeenCalledWith(organizations[0].id));
  await user.click(screen.getByRole("combobox", { name: "Kuruluş seç" })); await user.click(screen.getByRole("option", { name: "Kuruluş B" }));
  await act(async () => resolveB([{ id: "center-b", name: "B Merkezi", timezone: "Europe/Istanbul", state: "active", accessible: true, version: 1 }]));
  await act(async () => resolveA([{ id: "center-a", name: "A Merkezi", timezone: "Europe/Istanbul", state: "active", accessible: true, version: 1 }]));
  await user.click(screen.getByRole("combobox", { name: "Merkez seç" }));
  expect(screen.getByRole("option", { name: "B Merkezi" })).toBeVisible();
  expect(screen.queryByRole("option", { name: "A Merkezi" })).not.toBeInTheDocument();
});
