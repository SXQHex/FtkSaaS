import "../../i18n";
import { render, screen, within, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthApiError } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
const { change, send } = vi.hoisted(() => ({ change: vi.fn(), send: vi.fn() }));
vi.mock("./password", () => ({ changePassword: change, requestPasswordCode: send }));
import { PasswordChange } from "./password-change";
afterEach(() => vi.resetAllMocks());
async function open() {
  await userEvent.click(screen.getByRole("button", { name: "Parolayı değiştir" }));
  await userEvent.type(screen.getByLabelText("Mevcut parola"), "current-password");
  await userEvent.type(screen.getByLabelText("Yeni parola", { exact: true }), "new-password");
  await userEvent.type(screen.getByLabelText("Yeni parola tekrar"), "new-password");
  return within(screen.getByRole("dialog")).getByRole("button", { name: "Parolayı değiştir" });
}
it("validates confirmation and maps current-password denial without sending a code", async () => {
  change.mockRejectedValue(new AuthApiError("denied", 400, "current_password_invalid"));
  render(<PasswordChange onChanged={vi.fn()} />);
  const submit = await open();
  await userEvent.type(screen.getByLabelText("Yeni parola tekrar"), "mismatch");
  await userEvent.tab();
  expect(submit).toBeDisabled();
  await userEvent.click(submit);
  expect(await screen.findByText("Parolalar eşleşmiyor.")).toBeVisible();
  expect(change).not.toHaveBeenCalled();
  await userEvent.clear(screen.getByLabelText("Yeni parola tekrar"));
  await userEvent.type(screen.getByLabelText("Yeni parola tekrar"), "new-password");
  await userEvent.click(submit);
  expect(
    await screen.findByText("Mevcut parola eksik veya hatalı.", { exact: false }),
  ).toBeVisible();
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Mevcut parola")).toHaveValue("current-password");
});
it("requires explicit native code requests and discards any possibly consumed nonce after rejection", async () => {
  change
    .mockRejectedValueOnce(new AuthApiError("nonce needed", 400, "reauthentication_needed"))
    .mockRejectedValueOnce(new AuthApiError("bad current", 400, "current_password_invalid"))
    .mockResolvedValueOnce(undefined);
  send.mockResolvedValue(undefined);
  const changed = vi.fn().mockResolvedValue(undefined);
  render(<PasswordChange onChanged={changed} />);
  const submit = await open();
  await userEvent.click(submit);
  await screen.findByLabelText("Güvenlik kodu");
  expect(send).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Kod gönder" }));
  await userEvent.type(screen.getByLabelText("Güvenlik kodu"), "first-code");
  await userEvent.click(submit);
  await screen.findByText("Mevcut parola eksik veya hatalı.", { exact: false });
  expect(screen.getByLabelText("Güvenlik kodu")).toHaveValue("");
  expect(change.mock.calls[1][0]).toEqual({
    current: "current-password",
    password: "new-password",
    confirm: "new-password",
    nonce: "first-code",
  });
  expect(send).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: "Kod gönder" }));
  await userEvent.type(screen.getByLabelText("Güvenlik kodu"), "new-code");
  await userEvent.click(submit);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(changed).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: "Parolayı değiştir" }));
  expect(screen.getByLabelText("Mevcut parola")).toHaveValue("");
  expect(screen.queryByLabelText("Güvenlik kodu")).not.toBeInTheDocument();
});
it("keeps a pending native update protected from dismissal and duplicate submission", async () => {
  let finish!: () => void;
  change.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const changed = vi.fn().mockResolvedValue(undefined);
  render(<PasswordChange onChanged={changed} />);
  const submit = await open();
  await userEvent.click(submit);
  expect(submit).toBeDisabled();
  expect(screen.getByRole("button", { name: "Kapat" })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeVisible();
  await act(async () => finish());
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(change).toHaveBeenCalledOnce();
});

it("allows a first-password attempt with empty current password and lets native Auth reject protected accounts", async () => {
  change
    .mockRejectedValueOnce(new AuthApiError("required", 400, "current_password_required"))
    .mockResolvedValueOnce(undefined);
  const changed = vi.fn().mockResolvedValue(undefined);
  render(<PasswordChange onChanged={changed} />);
  const submit = await open();
  await userEvent.clear(screen.getByLabelText("Mevcut parola"));
  await userEvent.click(submit);
  expect(
    await screen.findByText("Mevcut parola eksik veya hatalı.", { exact: false }),
  ).toBeVisible();
  expect(change.mock.calls[0][0].current).toBe("");
  expect(send).not.toHaveBeenCalled();
  await userEvent.click(submit);
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
});
