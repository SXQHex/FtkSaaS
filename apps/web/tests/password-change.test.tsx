import { beforeEach, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { PasswordChange } from "../src/components/account/password-change";
type Result = { error: { code: string } | null };
const mocks = vi.hoisted(() => ({
  update:
    vi.fn<
      (input: { password: string; current_password?: string; nonce?: string }) => Promise<Result>
    >(),
  reauth: vi.fn<() => Promise<Result>>(),
  saved: vi.fn<() => void>(),
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({ auth: { updateUser: mocks.update, reauthenticate: mocks.reauth } }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.update.mockResolvedValue({ error: null });
  mocks.reauth.mockResolvedValue({ error: null });
});
async function fill(current = "synthetic-old") {
  const user = userEvent.setup();
  render(<PasswordChange onSaved={mocks.saved} />);
  await user.click(screen.getByText("Parolayı değiştir", { selector: "summary" }));
  if (current) await user.type(screen.getByLabelText("Mevcut parola"), current);
  await user.type(screen.getByLabelText("Yeni parola"), "synthetic-new");
  await user.type(screen.getByLabelText("Yeni parolayı tekrar yaz"), "synthetic-new");
  return user;
}
test("fresh native password update never requests a code", async () => {
  const user = await fill();
  expect(screen.queryByLabelText("Doğrulama kodu")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
  expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
    password: "synthetic-new",
    current_password: "synthetic-old",
  });
  expect(mocks.reauth).not.toHaveBeenCalled();
  expect(mocks.saved).toHaveBeenCalledOnce();
});
test("native reauthentication_needed reveals manual code request and resubmits native nonce", async () => {
  mocks.update.mockResolvedValueOnce({ error: { code: "reauthentication_needed" } });
  const user = await fill();
  await user.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
  expect(mocks.reauth).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Doğrulama kodu gönder" }));
  await user.type(await screen.findByLabelText("Doğrulama kodu"), "123456");
  await user.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
  expect(mocks.update).toHaveBeenLastCalledWith({
    password: "synthetic-new",
    current_password: "synthetic-old",
    nonce: "123456",
  });
  expect(mocks.saved).toHaveBeenCalledOnce();
  expect(JSON.stringify(sessionStorage)).not.toContain("synthetic-new");
});
test.each(["current_password_required", "current_password_invalid"])(
  "native %s marks the current password without sending mail",
  async (code) => {
    mocks.update.mockResolvedValue({ error: { code } });
    const user = await fill("");
    await user.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
    expect(screen.getByLabelText("Mevcut parola")).toHaveAttribute("aria-invalid", "true");
    expect(mocks.reauth).not.toHaveBeenCalled();
    expect(mocks.saved).not.toHaveBeenCalled();
  },
);
test("first password can be added when native Auth does not require an existing password", async () => {
  const user = await fill("");
  await user.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
  expect(mocks.update).toHaveBeenCalledWith({ password: "synthetic-new" });
  expect(mocks.saved).toHaveBeenCalledOnce();
});
test.each(["reauthentication_not_valid", "current_password_invalid"])(
  "native %s after nonce requires a new code request",
  async (code) => {
    mocks.update
      .mockResolvedValueOnce({ error: { code: "reauthentication_needed" } })
      .mockResolvedValueOnce({ error: { code } });
    const user = await fill();
    await user.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
    await user.click(screen.getByRole("button", { name: "Doğrulama kodu gönder" }));
    await user.type(await screen.findByLabelText("Doğrulama kodu"), "123456");
    await user.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
    expect(screen.queryByLabelText("Doğrulama kodu")).not.toBeInTheDocument();
    expect(mocks.reauth).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Doğrulama kodu gönder" })).toBeVisible();
    expect(mocks.saved).not.toHaveBeenCalled();
  },
);

test.each(["weak_password", "same_password"])(
  "native %s marks only the new password",
  async (code) => {
    mocks.update.mockResolvedValue({ error: { code } });
    const user = await fill();
    await user.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
    expect(screen.getByLabelText("Yeni parola")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Mevcut parola")).toHaveAttribute("aria-invalid", "false");
    expect(mocks.reauth).not.toHaveBeenCalled();
  },
);
test("failed reauthentication request does not expose a nonce field or retry update automatically", async () => {
  mocks.update.mockResolvedValue({ error: { code: "reauthentication_needed" } });
  mocks.reauth.mockResolvedValue({ error: { code: "over_email_send_rate_limit" } });
  const user = await fill();
  await user.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
  await user.click(screen.getByRole("button", { name: "Doğrulama kodu gönder" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Kimlik sağlayıcısı");
  expect(screen.queryByLabelText("Doğrulama kodu")).not.toBeInTheDocument();
  expect(mocks.update).toHaveBeenCalledOnce();
});
