import "../i18n";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState, type PropsWithChildren } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { LoginForm } from "../features/auth/login-form";
import { Dialog, DialogTitle } from "@ftksaas/ui/components/dialog";
import { Sheet, SheetTitle } from "@ftksaas/ui/components/sheet";
const state = vi.hoisted(() => ({
  ready: true,
  pathname: "/login",
  overlay: "none",
  password: vi.fn(),
  command: vi.fn<() => Promise<void>>(),
  commandMounted: vi.fn(),
  commandUnmounted: vi.fn(),
  router: { navigate: vi.fn(), invalidate: vi.fn(), latestLocation: { pathname: "/login" } },
  onSessionHandoff: undefined as ((pending: boolean) => void) | undefined,
  onChecking: undefined as ((pending: boolean) => void) | undefined,
  showLogin: undefined as (() => Promise<unknown>) | undefined,
}));
vi.mock("../features/auth/use-auth-session", () => ({
  useAuthSession: (_enabled: boolean, onSessionHandoff: (pending: boolean) => void) => {
    state.onSessionHandoff = onSessionHandoff;
    return state.ready;
  },
}));
vi.mock("../features/auth/query-access-recovery", () => ({
  observeQueryAccessFailures: (
    _queries: QueryClient,
    {
      onChecking,
      showLogin,
    }: { onChecking: (pending: boolean) => void; showLogin: () => Promise<unknown> },
  ) => {
    state.onChecking = onChecking;
    state.showLogin = showLogin;
    return () => {
      state.onChecking = undefined;
      state.showLogin = undefined;
    };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => state.router,
  useRouterState: ({
    select,
  }: {
    select: (snapshot: { location: { pathname: string }; matches: [] }) => unknown;
  }) => select({ location: { pathname: state.pathname }, matches: [] }),
  Outlet: () =>
    state.pathname === "/mfa" || state.pathname === "/reset-password" ? (
      <p>native-auth-gate</p>
    ) : state.pathname === "/login" ? (
      <LoginForm
        onPassword={state.password}
        onGoogle={async () => {
          throw new Error("fixture");
        }}
      />
    ) : state.overlay === "dialog" || state.overlay === "sheet" ? (
      <PrivateOverlay kind={state.overlay} />
    ) : (
      <p>private-account-fixture</p>
    ),
}));
import { RootLayout } from "./root-layout";

function NativeCommand() {
  const [phase, setPhase] = useState("ready");
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    state.commandMounted(content.current);
    return () => {
      state.commandUnmounted();
    };
  }, []);
  return (
    <div ref={content}>
      <label htmlFor="private-draft">Private draft</label>
      <input id="private-draft" defaultValue="unsaved draft" />
      <button
        type="button"
        disabled={phase === "pending"}
        onClick={() => {
          setPhase("pending");
          void state.command().then(() => setPhase("saved"));
        }}
      >
        Run native command
      </button>
      <p>{phase}</p>
    </div>
  );
}

function PrivateOverlay({ kind }: { kind: "dialog" | "sheet" }) {
  return (
    <>
      <p>private-account-fixture</p>
      {kind === "dialog" ? (
        <Dialog isOpen showCloseButton={false}>
          <DialogTitle>Private dialog</DialogTitle>
          <NativeCommand />
        </Dialog>
      ) : (
        <Sheet isOpen showCloseButton={false}>
          <SheetTitle>Private sheet</SheetTitle>
          <NativeCommand />
        </Sheet>
      )}
    </>
  );
}

async function renderRoot() {
  const queries = new QueryClient();
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<RootLayout />, {
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queries}>{children}</QueryClientProvider>
      ),
    });
  });
  return view;
}

afterEach(() => {
  state.ready = true;
  state.pathname = "/login";
  state.router.latestLocation.pathname = "/login";
  state.overlay = "none";
  state.onSessionHandoff = undefined;
  state.onChecking = undefined;
  state.showLogin = undefined;
  vi.resetAllMocks();
});

it("keeps the pending calendar return when a shared account or workspace Query requests login", async () => {
  state.pathname = "/account";
  const path =
    "/organizasyon/019a7b00-0000-7000-8000-000000000001/seans/019a7b00-0000-7000-8000-000000000002";
  await renderRoot();
  state.router.latestLocation.pathname = path;
  await state.showLogin?.();
  expect(state.router.navigate).toHaveBeenLastCalledWith({
    to: "/login",
    search: { next: path },
    replace: true,
  });
  state.router.latestLocation.pathname = "/account";
  await state.showLogin?.();
  expect(state.router.navigate).toHaveBeenLastCalledWith({ to: "/login", replace: true });
});
it("keeps the login form mounted while post-authentication account reading fails", async () => {
  let reject!: (reason: Error) => void;
  state.password.mockReturnValue(
    new Promise<void>((_, rejectPromise) => {
      reject = rejectPromise;
    }),
  );
  const { rerender } = await renderRoot();
  await userEvent.type(screen.getByLabelText("E-posta"), "fixture@example.invalid");
  await userEvent.type(screen.getByLabelText("Parola", { exact: true }), "fixture-password");
  await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
  await waitFor(() => expect(state.password).toHaveBeenCalledOnce());
  state.ready = false;
  rerender(<RootLayout />);
  expect(screen.getByLabelText("E-posta")).toHaveValue("fixture@example.invalid");
  reject(new Error("account-read-failed"));
  expect(
    await screen.findByText("Giriş yapılamadı. Bilgilerini kontrol edip yeniden dene."),
  ).toBeVisible();
});
it("immediately removes protected content during a session scope change", async () => {
  state.pathname = "/account";
  const { rerender } = await renderRoot();
  expect(screen.getByText("private-account-fixture")).toBeVisible();
  state.ready = false;
  await act(async () => rerender(<RootLayout />));
  expect(screen.queryByText("private-account-fixture")).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: /yükleniyor/i })).toBeVisible();
  expect(screen.getByRole("progressbar")).toBeVisible();
});

it("keeps same-user native commands mounted but entirely hidden and inert until revalidation", async () => {
  state.pathname = "/account";
  const { rerender } = await renderRoot();
  const privateContent = screen.getByText("private-account-fixture");
  expect(privateContent).toBeVisible();
  await act(async () => {
    state.onSessionHandoff?.(true);
    state.ready = false;
  });
  await act(async () => rerender(<RootLayout />));
  expect(privateContent).toBeInTheDocument();
  expect(privateContent).not.toBeVisible();
  expect(privateContent.parentElement).toHaveAttribute("aria-hidden", "true");
  expect(privateContent.parentElement).toHaveAttribute("inert");
  await act(async () => {
    state.ready = true;
    state.onSessionHandoff?.(false);
  });
  await act(async () => rerender(<RootLayout />));
  expect(privateContent).toBeVisible();
});

it.each(["dialog", "sheet"])(
  "mounts an immediately open private %s in the protected portal host without remounting it",
  async (kind) => {
    state.pathname = "/account";
    state.overlay = kind;
    const { container } = await renderRoot();
    const overlay = screen.getByRole("dialog", { name: `Private ${kind}` });
    expect(overlay).toBeVisible();
    expect(container).toContainElement(overlay);
    expect(
      screen.getByText("private-account-fixture").closest('[inert], [aria-hidden="true"]'),
    ).not.toBeNull();
    expect(state.commandMounted).toHaveBeenCalledOnce();
    expect(container).toContainElement(state.commandMounted.mock.calls[0][0]);
    expect(state.commandUnmounted).not.toHaveBeenCalled();
  },
);

it.each(["dialog", "sheet"])(
  "hides a private %s throughout a same-user handoff while its native command and draft survive",
  async (kind) => {
    let finish!: () => void;
    state.command.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    state.pathname = "/account";
    state.overlay = kind;
    const { rerender } = await renderRoot();
    const draft = screen.getByRole("textbox", { name: "Private draft" });
    await userEvent.type(draft, " stays");
    await userEvent.click(screen.getByRole("button", { name: "Run native command" }));
    expect(state.command).toHaveBeenCalledOnce();
    await act(async () => {
      state.onSessionHandoff?.(true);
      state.ready = false;
    });
    await act(async () => rerender(<RootLayout />));
    expect(draft).toBeInTheDocument();
    expect(draft).not.toBeVisible();
    expect(draft.closest("[inert]")).not.toBeNull();
    expect(draft.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole("dialog", { name: `Private ${kind}` })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /yükleniyor/i })).toBeVisible();
    expect(screen.getByRole("progressbar")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: /yükleniyor/i })).toBeVisible();
    await act(async () => finish());
    expect(state.commandUnmounted).not.toHaveBeenCalled();
    expect(screen.getByText("saved")).not.toBeVisible();
    await act(async () => {
      state.ready = true;
      state.onSessionHandoff?.(false);
    });
    await act(async () => rerender(<RootLayout />));
    expect(screen.getByRole("textbox", { name: "Private draft" })).toBe(draft);
    expect(draft).toBeVisible();
    expect(draft).toHaveValue("unsaved draft stays");
    expect(screen.getByText("saved")).toBeVisible();
    expect(screen.getByRole("dialog", { name: `Private ${kind}` })).toBeVisible();
    expect(state.command).toHaveBeenCalledOnce();
    expect(state.commandMounted).toHaveBeenCalledOnce();
    expect(state.commandUnmounted).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: `Private ${kind}` }).contains(document.activeElement),
      ).toBe(true),
    );
  },
);

it.each(["dialog", "sheet"])(
  "blocks the private %s during access revalidation and restores its existing draft",
  async (kind) => {
    state.pathname = "/account";
    state.overlay = kind;
    await renderRoot();
    const draft = screen.getByRole("textbox", { name: "Private draft" });
    await userEvent.type(draft, " stays");
    await act(async () => {
      state.onChecking?.(true);
    });
    expect(draft).not.toBeVisible();
    expect(draft.closest("[inert]")).not.toBeNull();
    expect(draft.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole("dialog", { name: `Private ${kind}` })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /yükleniyor/i })).toBeVisible();
    expect(screen.getByRole("progressbar")).toBeVisible();
    await act(async () => {
      state.onChecking?.(false);
    });
    expect(screen.getByRole("textbox", { name: "Private draft" })).toBe(draft);
    expect(draft).toBeVisible();
    expect(draft).toHaveValue("unsaved draft stays");
    expect(state.commandMounted).toHaveBeenCalledOnce();
    expect(state.commandUnmounted).not.toHaveBeenCalled();
    await waitFor(() => expect(draft).toHaveFocus());
  },
);

it.each(["/mfa", "/reset-password"])(
  "keeps the guarded native Auth screen visible during a same-user session handoff: %s",
  async (pathname) => {
    state.pathname = pathname;
    state.ready = false;
    const { container } = await renderRoot();
    const authGate = screen.getByText("native-auth-gate");
    expect(authGate).toBeVisible();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(screen.queryByRole("dialog", { name: /yükleniyor/i })).not.toBeInTheDocument();
  },
);

it.each(["/mfa", "/reset-password"])(
  "releases the private overlay and loading focus scope when navigating to %s",
  async (pathname) => {
    state.pathname = "/account";
    state.overlay = "dialog";
    const { rerender } = await renderRoot();
    const privateDialog = screen.getByRole("dialog", { name: "Private dialog" });
    await act(async () => {
      state.onChecking?.(true);
      state.onSessionHandoff?.(true);
      state.ready = false;
    });
    await act(async () => rerender(<RootLayout />));
    expect(screen.getByRole("dialog", { name: /yükleniyor/i })).toBeVisible();
    state.pathname = pathname;
    await act(async () => rerender(<RootLayout />));
    const authGate = screen.getByText("native-auth-gate");
    expect(authGate).toBeVisible();
    expect(authGate.closest("[inert]")).toBeNull();
    expect(authGate.closest('[aria-hidden="true"]')).toBeNull();
    expect(privateDialog).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /yükleniyor/i })).not.toBeInTheDocument();
  },
);
