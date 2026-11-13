import "../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { LoginForm } from "../features/auth/login-form";
const state = vi.hoisted(() => ({ ready: true, pathname: "/login", password: vi.fn() }));
vi.mock("../features/auth/use-auth-session", () => ({ useAuthSession: () => state.ready }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => state.pathname,
  Outlet: () =>
    state.pathname === "/login" ? (
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
afterEach(() => {
  state.ready = true;
  state.pathname = "/login";
  vi.resetAllMocks();
});
it("keeps the login form mounted while post-authentication account reading fails", async () => {
  let reject!: (reason: Error) => void;
  state.password.mockReturnValue(
    new Promise<void>((_, rejectPromise) => {
      reject = rejectPromise;
    }),
  );
  const { rerender } = render(<RootLayout />);
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
  const { rerender } = render(<RootLayout />);
  expect(screen.getByText("private-account-fixture")).toBeVisible();
  state.ready = false;
  rerender(<RootLayout />);
  expect(screen.queryByText("private-account-fixture")).not.toBeInTheDocument();
});
