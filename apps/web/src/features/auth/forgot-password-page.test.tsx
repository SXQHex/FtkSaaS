import "../../i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./password-recovery", () => ({ requestPasswordReset: request }));
import { ForgotPasswordPage } from "./forgot-password-page";
afterEach(() => vi.resetAllMocks());
it("validates the address and presents the same neutral recovery notice", async () => {
  request.mockResolvedValue(undefined);
  render(<ForgotPasswordPage />);
  await userEvent.click(screen.getByRole("button", { name: "Bağlantı gönder" }));
  expect(await screen.findByText("Geçerli bir e-posta adresi gir.")).toBeVisible();
  expect(request).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText("E-posta"), "fixture@example.invalid");
  await userEvent.click(screen.getByRole("button", { name: "Bağlantı gönder" }));
  expect(await screen.findByRole("heading", { name: "E-postanı kontrol et" })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Adres uygunsa sıfırlama bağlantısı gönderilecektir.",
  );
  expect(request).toHaveBeenCalledExactlyOnceWith("fixture@example.invalid");
});
it("preserves input and offers an explicit retry after a native failure", async () => {
  request.mockRejectedValue(new Error("provider-private-detail"));
  render(<ForgotPasswordPage />);
  await userEvent.type(screen.getByLabelText("E-posta"), "fixture@example.invalid");
  await userEvent.click(screen.getByRole("button", { name: "Bağlantı gönder" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "İstek tamamlanamadı. Daha sonra yeniden dene.",
  );
  expect(screen.getByLabelText("E-posta")).toHaveValue("fixture@example.invalid");
  expect(screen.queryByText("provider-private-detail")).not.toBeInTheDocument();
});
