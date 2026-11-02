import { render } from "./render";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { AccountView, OrganizationView } from "@ftksaas/api-contracts";
import { StudioWorkspace } from "../src/components/admin/studio-workspace";
const mocks = vi.hoisted(() => ({
  account: vi.fn<typeof import("../src/lib/api").getAccount>(),
  organizations: vi.fn<typeof import("../src/lib/api").getOrganizations>(),
  settings: vi.fn<typeof import("../src/lib/api").getUserSettings>(),
  calendar: vi.fn<typeof import("../src/lib/api").getCalendar>(),
  centers: vi.fn<typeof import("../src/lib/api").getCenters>(),
  replace: vi.fn<(href: string) => void>(),
  refresh: vi.fn<() => void>(),
  setTheme: vi.fn<(theme: string) => void>(),
  unsubscribe: vi.fn<() => void>(),
  signOut: vi.fn<() => Promise<{ error: Error | null }>>(),
  send: vi.fn<(command: import("../src/lib/studio-setup").SetupCommand) => Promise<unknown>>(),
  setup: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
  listener: null as null | ((event: string) => void),
}));
const router = { replace: mocks.replace, refresh: mocks.refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "system", setTheme: mocks.setTheme }) }));
vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  getAccount: mocks.account,
  getOrganizations: mocks.organizations,
  getUserSettings: mocks.settings,
  getCenters: mocks.centers,
  getCalendar: mocks.calendar,
}));
vi.mock("../src/lib/studio-setup", async (original) => ({
  ...(await original<typeof import("../src/lib/studio-setup")>()),
  setupCall: mocks.setup,
  sendSetupCommand: mocks.send,
  getSetupDisciplines: async () => [],
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      signOut: mocks.signOut,
      onAuthStateChange: (listener: (event: string) => void) => {
        mocks.listener = listener;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    },
  }),
}));
const account: AccountView = {
  id: "019a2b3c-4d5e-7000-8000-000000000001",
  state: "active",
  display_name: "Test Yöneticisi",
};
const organizations: OrganizationView[] = [
  {
    id: "019a2b3c-4d5e-7000-8000-000000000002",
    name: "Kuruluş A",
    state: "active",
    access_mode: "normal",
    version: 1,
  },
  {
    id: "019a2b3c-4d5e-7000-8000-000000000003",
    name: "Kuruluş B",
    state: "active",
    access_mode: "closed",
    version: 1,
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.location.hash = "";
  mocks.calendar.mockResolvedValue([]);
  mocks.account.mockResolvedValue(account);
  mocks.organizations.mockResolvedValue(organizations);
  mocks.settings.mockResolvedValue({ remember_context: false });
  mocks.centers.mockResolvedValue([
    {
      id: "center-a",
      name: "A Merkezi",
      timezone: "Europe/Istanbul",
      state: "active",
      accessible: true,
      version: 1,
    },
    {
      id: "hidden",
      name: "Gizli Merkez",
      timezone: "Europe/Istanbul",
      state: "active",
      accessible: false,
      version: 1,
    },
  ]);
  mocks.setup.mockImplementation(async (operation, input) => {
    if (operation === "organization_get_v1")
      return organizations.find((org) => org.id === input.org_id);
    if (operation === "centers_list_v1")
      return {
        items: [
          {
            id: "center-a",
            name: "A Merkezi",
            timezone: "Europe/Istanbul",
            state: "active",
            accessible: true,
            version: 1,
          },
        ],
        next_cursor: null,
      };
    if (operation === "policies_get_v1") return [];
    if (operation === "subscription_get_v1")
      return { plan: "starter", limits: { entries: [] }, usage: { entries: [] } };
    return { items: [], next_cursor: null };
  });
  mocks.send.mockResolvedValue({});
  sessionStorage.clear();
  mocks.signOut.mockResolvedValue({ error: null });
  HTMLElement.prototype.scrollIntoView = vi.fn<HTMLElement["scrollIntoView"]>();
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = vi.fn<HTMLElement["setPointerCapture"]>();
  HTMLElement.prototype.releasePointerCapture = vi.fn<HTMLElement["releasePointerCapture"]>();
});
test("live shell reads accessible studios without selectors, sample records or closed-organization reads", async () => {
  const user = userEvent.setup();
  render(<StudioWorkspace />);
  await screen.findByRole("heading", { name: "Merhaba, Test Yöneticisi" });
  await user.click(screen.getAllByRole("button", { name: "Stüdyo" })[0]);
  await user.click(await screen.findByRole("button", { name: "Kuruluş A" }));
  expect(await screen.findByRole("heading", { name: "A Merkezi" })).toBeVisible();
  expect(screen.queryByText("Gizli Merkez")).not.toBeInTheDocument();
  expect(mocks.setup.mock.calls.every(([, input]) => input.org_id !== organizations[1].id)).toBe(
    true,
  );
  expect(mocks.centers).toHaveBeenCalledExactlyOnceWith(organizations[0].id);
  expect(screen.queryByRole("combobox", { name: "Kuruluş seç" })).not.toBeInTheDocument();
  expect(screen.queryByText("Örnek Yönetici")).not.toBeInTheDocument();
  expect(screen.queryByText("Ece Demir")).not.toBeInTheDocument();
});
test("late account response after sign-out cannot repopulate the shell", async () => {
  let resolve!: (value: AccountView) => void;
  mocks.account.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  render(<StudioWorkspace />);
  act(() => mocks.listener?.("SIGNED_OUT"));
  await act(async () => resolve(account));
  expect(mocks.replace).toHaveBeenCalledWith("/login");
  expect(screen.queryByText("Test Yöneticisi")).not.toBeInTheDocument();
  expect(mocks.centers).not.toHaveBeenCalled();
});
test("API failure renders a retryable error without demo fallback", async () => {
  mocks.account.mockRejectedValue(new Error("offline"));
  render(<StudioWorkspace />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantı kurulamadı");
  expect(screen.queryByText("Ece Demir")).not.toBeInTheDocument();
});
test("account theme initializes an unset device but never overwrites a saved device choice", async () => {
  mocks.settings.mockResolvedValue({ remember_context: false, theme: "light" });
  const first = render(<StudioWorkspace />);
  await screen.findByRole("heading", { name: "Merhaba, Test Yöneticisi" });
  expect(mocks.setTheme).toHaveBeenCalledWith("light");
  first.unmount();
  mocks.setTheme.mockClear();
  localStorage.setItem("theme", "dark");
  render(<StudioWorkspace />);
  await screen.findByRole("heading", { name: "Merhaba, Test Yöneticisi" });
  expect(mocks.setTheme).not.toHaveBeenCalled();
});

test("self center-manager assignment rereads the previously forbidden task list", async () => {
  const { ApiFailure } = await import("../src/lib/api");
  let granted = false;
  const original = mocks.setup.getMockImplementation()!;
  mocks.setup.mockImplementation(async (op, input) => {
    if (
      op === "management_state_get_v1" &&
      input.operation === "session_assignment_set_v1" &&
      !granted
    )
      throw new ApiFailure({
        ok: false,
        error: { code: "FORBIDDEN", retryable: false, trace_id: account.id },
      });
    return original(op, input);
  });
  mocks.send.mockImplementation(async () => {
    granted = true;
    return {};
  });
  const user = userEvent.setup();
  render(<StudioWorkspace />);
  await screen.findByRole("heading", { name: "Merhaba, Test Yöneticisi" });
  await user.click(screen.getAllByRole("button", { name: "Stüdyo" })[0]);
  await user.click(await screen.findByRole("button", { name: "Kuruluş A" }));
  await user.click(
    await screen.findByRole("button", { name: "Bu merkezin yöneticiliğini üstlen" }),
  );
  expect(await screen.findByText("Eğitmen atanması gereken seans yok.")).toBeVisible();
  expect(mocks.send.mock.calls[0][0].operation).toBe("manager_self_assign_center_v1");
});
