import { render } from "./render";
import { act, screen, within } from "@testing-library/react";
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
  listener: null as null | ((event: string, session?: { user: { id: string } } | null) => void),
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
      onAuthStateChange: (listener: NonNullable<typeof mocks.listener>) => {
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
  // The shell assertions exercise API scope; module instrumentation is not an API timeout.
  await import("../src/components/setup/studio-setup");
  const user = userEvent.setup();
  render(<StudioWorkspace authUserId="native-user" />);
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
  render(<StudioWorkspace authUserId="native-user" />);
  act(() => mocks.listener?.("SIGNED_OUT"));
  await act(async () => resolve(account));
  expect(mocks.replace).toHaveBeenCalledWith("/login");
  expect(screen.queryByText("Test Yöneticisi")).not.toBeInTheDocument();
  expect(mocks.centers).not.toHaveBeenCalled();
});
test("API failure renders a retryable error without demo fallback", async () => {
  mocks.account.mockRejectedValue(new Error("offline"));
  render(<StudioWorkspace authUserId="native-user" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantı kurulamadı");
  expect(screen.queryByText("Ece Demir")).not.toBeInTheDocument();
});
test.each([
  ["reports", "Raporu getir"],
  ["automation", "Otomasyonlar"],
])(
  "implemented %s module does not also show a preparation placeholder",
  async (section, action) => {
    await import("../src/components/reports/reports-workspace");
    await import("../src/components/automation/automation-workspace");
    window.location.hash = `#${section}`;
    render(<StudioWorkspace authUserId="native-user" />);
    await userEvent
      .setup()
      .selectOptions(
        await screen.findByRole("combobox", { name: "Merkez" }),
        `${organizations[0].id}:center-a`,
      );
    expect(await screen.findByRole("button", { name: action })).toBeVisible();
    expect(screen.queryByText("Bu bölüm hazırlanıyor")).not.toBeInTheDocument();
  },
);
test("account theme initializes an unset device but never overwrites a saved device choice", async () => {
  mocks.settings.mockResolvedValue({ remember_context: false, theme: "light" });
  const first = render(<StudioWorkspace authUserId="native-user" />);
  await screen.findByRole("heading", { name: "Merhaba, Test Yöneticisi" });
  expect(mocks.setTheme).toHaveBeenCalledWith("light");
  first.unmount();
  mocks.setTheme.mockClear();
  localStorage.setItem("theme", "dark");
  render(<StudioWorkspace authUserId="native-user" />);
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
  render(<StudioWorkspace authUserId="native-user" />);
  await screen.findByRole("heading", { name: "Merhaba, Test Yöneticisi" });
  await user.click(screen.getAllByRole("button", { name: "Stüdyo" })[0]);
  await user.click(await screen.findByRole("button", { name: "Kuruluş A" }));
  await user.click(
    await screen.findByRole("button", { name: "Bu merkezin yöneticiliğini üstlen" }),
  );
  expect(await screen.findByText("Eğitmen atanması gereken seans yok.")).toBeVisible();
  expect(mocks.send.mock.calls[0][0].operation).toBe("manager_self_assign_center_v1");
});

test("switching native accounts hides the old tenant immediately", async () => {
  render(<StudioWorkspace authUserId="native-user" />);
  await screen.findByRole("heading", { name: "Merhaba, Test Yöneticisi" });
  act(() => mocks.listener?.("SIGNED_IN", { user: { id: "other-native-user" } }));
  expect(screen.queryByText("Test Yöneticisi")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Merhaba, Test Yöneticisi" }),
  ).not.toBeInTheDocument();
  expect(mocks.replace).toHaveBeenCalledWith("/login");
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
test("a late tenant read cannot restore the previous account after switching", async () => {
  let finish!: (value: Awaited<ReturnType<typeof mocks.centers>>) => void;
  mocks.centers.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<StudioWorkspace authUserId="native-user" />);
  await vi.waitFor(() => expect(mocks.centers).toHaveBeenCalledOnce());
  act(() => mocks.listener?.("SIGNED_IN", { user: { id: "other-native-user" } }));
  await act(async () => finish([]));
  expect(screen.queryByText("Test Yöneticisi")).not.toBeInTheDocument();
  expect(mocks.replace).toHaveBeenCalledWith("/login");
});
test("refreshing the same native identity keeps the active workspace", async () => {
  render(<StudioWorkspace authUserId="native-user" />);
  await screen.findByRole("heading", { name: "Merhaba, Test Yöneticisi" });
  act(() => mocks.listener?.("SIGNED_IN", { user: { id: "native-user" } }));
  expect(screen.getByRole("heading", { name: "Merhaba, Test Yöneticisi" })).toBeVisible();
  expect(mocks.replace).not.toHaveBeenCalled();
});

test("pending operations stay reachable when organization discovery is denied", async () => {
  mocks.organizations.mockRejectedValueOnce(Error("Forbidden"));
  const user = userEvent.setup();
  render(<StudioWorkspace authUserId="native-user" />);
  await screen.findByRole("alert");
  await user.click(await screen.findByRole("button", { name: "Bekleyen işlemleri aç" }));
  expect(await screen.findByText("Bu hesap için bu sekmede bekleyen işlem yok.")).toBeVisible();
  expect(mocks.centers).not.toHaveBeenCalled();
});

test("an authentication rejection cannot be reopened by a late account response", async () => {
  const { ApiFailure } = await import("../src/lib/api");
  let finish!: (value: AccountView) => void;
  mocks.account.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  mocks.organizations.mockRejectedValueOnce(
    new ApiFailure({
      ok: false,
      error: {
        code: "AUTH_REQUIRED",
        retryable: false,
        trace_id: account.id,
      },
    }),
  );
  render(<StudioWorkspace authUserId="native-user" />);
  await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?error=session"));
  await act(async () => finish(account));
  expect(screen.queryByRole("button", { name: "Bekleyen işlemleri aç" })).not.toBeInTheDocument();
});

test("a late Auth rejection still clears recovery after an earlier unrelated read fails", async () => {
  const { ApiFailure } = await import("../src/lib/api");
  let rejectSettings!: (error: unknown) => void;
  mocks.settings.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectSettings = reject;
      }),
  );
  mocks.organizations.mockRejectedValueOnce(Error("offline"));
  render(<StudioWorkspace authUserId="native-user" />);
  await screen.findByRole("button", { name: "Bekleyen işlemleri aç" });
  await act(async () =>
    rejectSettings(
      new ApiFailure({
        ok: false,
        error: {
          code: "SESSION_REVOKED",
          retryable: false,
          trace_id: account.id,
        },
      }),
    ),
  );
  expect(screen.queryByRole("button", { name: "Bekleyen işlemleri aç" })).not.toBeInTheDocument();
  expect(mocks.replace).toHaveBeenCalledWith("/login?error=session");
});

test("an unavailable center catalog does not block organization inbox discovery", async () => {
  const { ApiFailure } = await import("../src/lib/api");
  mocks.centers.mockRejectedValue(
    new ApiFailure({
      ok: false,
      error: { code: "FORBIDDEN", retryable: false, trace_id: "synthetic" },
    }),
  );
  window.location.hash = "#inbox";
  render(<StudioWorkspace authUserId="native-user" />);
  expect(await screen.findByRole("combobox", { name: "Organizasyon" })).toHaveValue(
    organizations[0].id,
  );
  expect(
    screen.getByText(/Kuruluş A: merkezler okunamadı/).closest("[role=alert]"),
  ).toBeInTheDocument();
  expect(
    mocks.setup.mock.calls.some(
      ([operation, input]) =>
        operation === "notifications_list_v1" && input.org_id === organizations[0].id,
    ),
  ).toBe(true);
  expect(mocks.setup.mock.calls.some(([operation]) => operation === "calendar_get_v1")).toBe(false);
});
test("center discovery Auth rejection still clears the whole account and recovery", async () => {
  const { ApiFailure } = await import("../src/lib/api");
  mocks.centers.mockRejectedValue(
    new ApiFailure({
      ok: false,
      error: { code: "SESSION_REVOKED", retryable: false, trace_id: "synthetic" },
    }),
  );
  render(<StudioWorkspace authUserId="native-user" />);
  await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?error=session"));
  expect(screen.queryByRole("button", { name: "Bekleyen işlemleri aç" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Merhaba, Test Yöneticisi" }),
  ).not.toBeInTheDocument();
});

test("retrying a center read clears its old error and preserves organization-only navigation", async () => {
  mocks.centers.mockRejectedValueOnce(new Error("offline"));
  window.location.hash = "#inbox";
  const user = userEvent.setup();
  render(<StudioWorkspace authUserId="native-user" />);
  const message = await screen.findByText(/Kuruluş A: merkezler okunamadı/);
  const alert = message.closest('[role="alert"]')!;
  await user.click(within(alert as HTMLElement).getByRole("button", { name: "Yeniden dene" }));
  await vi.waitFor(() =>
    expect(screen.queryByText(/Kuruluş A: merkezler okunamadı/)).not.toBeInTheDocument(),
  );
  expect(await screen.findByRole("combobox", { name: "Organizasyon" })).toHaveValue(
    organizations[0].id,
  );
  expect(mocks.centers).toHaveBeenCalledTimes(2);
  expect(window.location.hash).toBe("#inbox");
});

test("returning to the workspace revalidates revoked scope before old actions can reappear", async () => {
  render(<StudioWorkspace authUserId="native-user" />);
  await screen.findByRole("heading", { name: "Merhaba, Test Yöneticisi" });
  mocks.organizations.mockResolvedValue([]);
  act(() => window.dispatchEvent(new Event("focus")));
  expect(
    screen.queryByRole("heading", { name: "Merhaba, Test Yöneticisi" }),
  ).not.toBeInTheDocument();
  await vi.waitFor(() => expect(mocks.organizations).toHaveBeenCalledTimes(2));
  await screen.findByRole("heading", { name: "Merhaba, Test Yöneticisi" });
  expect(screen.queryByRole("button", { name: "Kuruluş A" })).not.toBeInTheDocument();
});
