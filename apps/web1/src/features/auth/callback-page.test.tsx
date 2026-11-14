import "../../i18n";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { captured } = vi.hoisted(() => ({ captured: vi.fn() }));
vi.mock("./callback", () => ({ capturedCallback: captured }));
import { CallbackPage } from "./callback-page";
afterEach(() => vi.resetAllMocks());
it("offers a neutral account check for a no-code email confirmation without claiming a new session", () => {
  captured.mockReturnValue({ next: "/account" });
  render(<CallbackPage />);
  expect(screen.getByRole("heading", { name: "Hesap doğrulaması" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Hesabım" })).toHaveAttribute("href", "/account");
  expect(screen.getByText("E-posta değişikliği yaptıysan", { exact: false })).toBeVisible();
});
it.each([
  { next: "/account", providerError: true },
  { next: "/account", code: "rejected-code" },
  { next: "/reset-password" },
])(
  "keeps provider/code/recovery failures separate from the no-code informational state: %j",
  (input) => {
    captured.mockReturnValue(input);
    render(<CallbackPage />);
    expect(screen.queryByRole("heading", { name: "Hesap doğrulaması" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hesabım" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bağlantı tamamlanamadı", level: 1 })).toBeVisible();
  },
);
