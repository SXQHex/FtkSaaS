import "../../i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
const { save, read } = vi.hoisted(() => ({ save: vi.fn(), read: vi.fn() }));
vi.mock("./password-recovery", () => ({ saveRecoveredPassword: save }));
vi.mock("../../lib/account", () => ({ readAccount: read }));
import { ResetPasswordPage } from "./reset-password-page";
afterEach(() => vi.resetAllMocks());
it("does not submit mismatched passwords", async () => {
  render(<ResetPasswordPage />);
  await userEvent.type(screen.getByLabelText("Yeni parola"), "fixture-password");
  await userEvent.type(screen.getByLabelText("Parola tekrar"), "different-password");
  await userEvent.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
  expect(await screen.findByText("Parolalar eşleşmiyor.")).toBeVisible();
  expect(save).not.toHaveBeenCalled();
});
it("reports a successful password save truthfully when the account reread fails", async () => {
  save.mockResolvedValue(undefined);
  read.mockRejectedValue(new Error("temporary-network"));
  render(<ResetPasswordPage />);
  await userEvent.type(screen.getByLabelText("Yeni parola"), "fixture-password");
  await userEvent.type(screen.getByLabelText("Parola tekrar"), "fixture-password");
  await userEvent.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
  expect(
    await screen.findByText("Parolan kaydedildi. Hesap bilgileri şu anda yenilenemedi."),
  ).toBeVisible();
  expect(save).toHaveBeenCalledExactlyOnceWith("fixture-password");
  expect(read).toHaveBeenCalledOnce();
  expect(screen.queryByLabelText("Yeni parola")).not.toBeInTheDocument();
});
