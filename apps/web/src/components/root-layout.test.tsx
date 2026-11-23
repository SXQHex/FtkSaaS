import "../i18n";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { LoginForm } from "../features/auth/login-form";
const state = vi.hoisted(() => ({
  ready: true,
  pathname: "/login",
  password: vi.fn(),
  onSessionHandoff: undefined as ((pending: boolean) => void) | undefined,
}));
vi.mock("../features/auth/use-auth-session", () => ({
  useAuthSession: (_enabled: boolean, onSessionHandoff: (pending: boolean) => void) => {
    state.onSessionHandoff = onSessionHandoff;
    return state.ready;
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ navigate: vi.fn() }),
  useRouterState: () => state.pathname,
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
    ) : (
      <p>private-account-fixture</p>
    ),
}));
import { RootLayout } from "./root-layout";
function renderRoot() {
  const queries = new QueryClient();
  return render(<RootLayout />, {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queries}>{children}</QueryClientProvider>
    ),
  });
}

afterEach(() => {
  state.ready = true;
  state.pathname = "/login";
  state.onSessionHandoff = undefined;
  vi.resetAllMocks();
});
it("keeps the login form mounted while post-authentication account reading fails", async () => {
  let reject!: (reason: Error) => void;
  state.password.mockReturnValue(
    new Promise<void>((_, rejectPromise) => {
      reject = rejectPromise;
    }),
  );
  const { rerender } = renderRoot();
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
it("immediately removes protected content during a session scope change", () => {
  state.pathname = "/account";
  const { rerender } = renderRoot();
  expect(screen.getByText("private-account-fixture")).toBeVisible();
  state.ready = false;
  rerender(<RootLayout />);
  expect(screen.queryByText("private-account-fixture")).not.toBeInTheDocument();
});

it("keeps same-user native commands mounted but entirely hidden and inert until revalidation", () => {
  state.pathname = "/account";
  const { rerender } = renderRoot();
  const privateContent = screen.getByText("private-account-fixture");
  expect(privateContent).toBeVisible();
  act(() => {
    state.onSessionHandoff?.(true);
    state.ready = false;
  });
  rerender(<RootLayout />);
  expect(privateContent).toBeInTheDocument();
  expect(privateContent).not.toBeVisible();
  expect(privateContent.parentElement).toHaveAttribute("aria-hidden", "true");
  expect(privateContent.parentElement).toHaveAttribute("inert");
  act(() => {
    state.ready = true;
    state.onSessionHandoff?.(false);
  });
  rerender(<RootLayout />);
  expect(privateContent).toBeVisible();
});

it.each(["/mfa", "/reset-password"])(
  "keeps the guarded native Auth screen visible during a same-user session handoff: %s",
  (pathname) => {
    state.pathname = pathname;
    state.ready = false;
    const { container } = renderRoot();
    const authGate = screen.getByText("native-auth-gate");
    expect(authGate).toBeVisible();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  },
);
