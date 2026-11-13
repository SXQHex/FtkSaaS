import "../../i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

it("validates empty fields before invoking native authentication", async () => {
  const login = vi.fn();
  render(<LoginForm onPassword={login} onGoogle={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
  expect(await screen.findByText("Geçerli bir e-posta adresi gir.")).toBeVisible();
  expect(screen.getByLabelText("E-posta")).toHaveAttribute("aria-invalid", "true");
  expect(login).not.toHaveBeenCalled();
});
it("sends entered credentials once and reports failure without clearing the email", async () => {
  const login = vi.fn().mockRejectedValue(new Error("provider-detail"));
  render(<LoginForm onPassword={login} onGoogle={vi.fn()} />);
  await userEvent.type(screen.getByLabelText("E-posta"), "test@example.invalid");
  await userEvent.type(screen.getByLabelText("Parola", { exact: true }), "test-password");
  await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
  expect(
    await screen.findByText("Giriş yapılamadı. Bilgilerini kontrol edip yeniden dene."),
  ).toBeVisible();
  expect(login).toHaveBeenCalledExactlyOnceWith({
    email: "test@example.invalid",
    password: "test-password",
  });
  expect(screen.getByLabelText("E-posta")).toHaveValue("test@example.invalid");
  expect(screen.queryByText("provider-detail")).not.toBeInTheDocument();
});
