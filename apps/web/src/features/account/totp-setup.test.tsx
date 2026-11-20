import "../../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
const { enroll, confirm } = vi.hoisted(() => ({
  enroll: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("./security", () => ({
  enrollTotp: enroll,
  confirmTotpSetup: confirm,
}));
import { TotpSetup } from "./totp-setup";
afterEach(() => vi.resetAllMocks());
function ready() {
  enroll.mockResolvedValue({
    id: "pending",
    type: "totp",
    totp: { secret: "SYNTHETIC-KEY", qr_code: "data:image/svg+xml,synthetic" },
  });
}
it("shows only the current native enrollment and clears it on verified completion", async () => {
  ready();
  confirm.mockResolvedValue(undefined);
  const changed = vi.fn().mockResolvedValue(undefined);
  render(<TotpSetup onChanged={changed} />);
  expect(screen.queryByText("SYNTHETIC-KEY")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Kur" }));
  expect(await screen.findByText("SYNTHETIC-KEY")).toBeVisible();
  await userEvent.type(screen.getByLabelText("Uygulamadaki 6 haneli kod"), "123456");
  await userEvent.click(screen.getByRole("button", { name: "Kodu doğrula" }));
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(confirm).toHaveBeenCalledExactlyOnceWith("pending", "123456");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("SYNTHETIC-KEY")).not.toBeInTheDocument();
});
it("does not claim completion when native verification fails", async () => {
  ready();
  confirm.mockRejectedValue(new Error("denied"));
  const changed = vi.fn().mockResolvedValue(undefined);
  render(<TotpSetup onChanged={changed} />);
  await userEvent.click(screen.getByRole("button", { name: "Kur" }));
  await userEvent.type(await screen.findByLabelText("Uygulamadaki 6 haneli kod"), "123456");
  await userEvent.click(screen.getByRole("button", { name: "Kodu doğrula" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(changed).toHaveBeenCalledOnce();
  expect(screen.getByLabelText("Uygulamadaki 6 haneli kod")).toBeVisible();
});
it("cancels locally without any native removal or new enrollment", async () => {
  ready();
  const changed = vi.fn().mockResolvedValue(undefined);
  render(<TotpSetup onChanged={changed} />);
  await userEvent.click(screen.getByRole("button", { name: "Kur" }));
  await screen.findByText("SYNTHETIC-KEY");
  await userEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(enroll).toHaveBeenCalledOnce();
  expect(screen.queryByText("SYNTHETIC-KEY")).not.toBeInTheDocument();
});
