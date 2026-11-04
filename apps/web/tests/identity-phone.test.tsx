import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountView } from "@ftksaas/api-contracts";
import type { ResendParams, VerifyOtpParams, UserAttributes } from "@supabase/supabase-js";
import { render } from "./render";
import { IdentityForm } from "../src/components/account/identity-form";
const mocks = vi.hoisted(() => ({
  update: vi.fn<(input: UserAttributes) => Promise<{ error: Error | null }>>(),
  resend: vi.fn<(input: ResendParams) => Promise<{ error: Error | null }>>(),
  verify: vi.fn<(input: VerifyOtpParams) => Promise<{ error: Error | null }>>(),
  saved: vi.fn<() => void>(),
  remember: vi.fn<(path: string) => Promise<void>>(),
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: { updateUser: mocks.update, resend: mocks.resend, verifyOtp: mocks.verify },
  }),
}));
vi.mock("../src/lib/auth-return", () => ({ rememberAuthReturn: mocks.remember }));
const account: AccountView = {
  id: "019a2b3c-4d5e-7000-8000-000000000080",
  state: "active",
  display_name: "Synthetic",
  identity: {
    given_name: null,
    family_name: null,
    email: "synthetic@example.invalid",
    email_verified_at: "2026-11-01T00:00:00Z",
    phone: "12025550101",
    phone_verified_at: "2026-11-01T00:00:00Z",
    pending_phone: "12025550102",
    pending_email: null,
    unverified_phone: null,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockResolvedValue({ error: null });
  mocks.resend.mockResolvedValue({ error: null });
  mocks.verify.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
function phoneForm() {
  return within(screen.getByLabelText("Yeni telefon").closest("form")!);
}
test("phone reissue uses authenticated updateUser with the server pending number, leaving verified phone unchanged", async () => {
  const user = userEvent.setup();
  render(<IdentityForm account={account} onSaved={mocks.saved} />);
  await user.type(screen.getByLabelText("Yeni telefon"), "0555 123 45 67");
  await user.click(phoneForm().getByRole("button", { name: "Kodu tekrar gönder" }));
  expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ phone: "12025550102" });
  expect(mocks.resend).not.toHaveBeenCalled();
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.saved).toHaveBeenCalledTimes(1);
  expect(screen.getByText("12025550101")).toBeInTheDocument();
  expect(screen.getByText("12025550102")).toBeInTheDocument();
});
test("native reissue cooldown failure is not success and preserves pending/verified identity", async () => {
  mocks.update.mockResolvedValue({ error: new Error("over_sms_send_rate_limit") });
  const user = userEvent.setup();
  render(<IdentityForm account={account} onSaved={mocks.saved} />);
  await user.click(phoneForm().getByRole("button", { name: "Kodu tekrar gönder" }));
  await screen.findByRole("alert");
  expect(mocks.saved).not.toHaveBeenCalled();
  expect(
    screen.queryByText(
      "Doğrulama isteği alındı. Değişiklik doğrulama tamamlandıktan sonra geçerli olur.",
    ),
  ).not.toBeInTheDocument();
  expect(screen.getByText("12025550101")).toBeInTheDocument();
  expect(screen.getByText("12025550102")).toBeInTheDocument();
});
test("wrong code preserves identity and subsequent native proof invokes the existing account refresh", async () => {
  const user = userEvent.setup();
  mocks.verify
    .mockResolvedValueOnce({ error: new Error("otp_expired") })
    .mockResolvedValueOnce({ error: null });
  render(<IdentityForm account={account} onSaved={mocks.saved} />);
  const code = screen.getByLabelText("SMS doğrulama kodu"),
    submit = within(code.closest("form")!).getByRole("button");
  await user.type(code, "000000");
  await user.click(submit);
  await screen.findByRole("alert");
  expect(mocks.saved).not.toHaveBeenCalled();
  expect(screen.getByText("12025550101")).toBeInTheDocument();
  await user.clear(code);
  await user.type(code, "654322");
  await user.click(submit);
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledTimes(1));
  expect(mocks.verify).toHaveBeenLastCalledWith({
    phone: "12025550102",
    token: "654322",
    type: "phone_change",
  });
  expect(mocks.update).not.toHaveBeenCalled();
});
test("email change reissue retains its existing resend and redirect flow", async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "https://app.example.invalid");
  const user = userEvent.setup();
  render(
    <IdentityForm
      account={{
        ...account,
        identity: { ...account.identity!, pending_email: "pending@example.invalid" },
      }}
      onSaved={mocks.saved}
    />,
  );
  await user.click(
    within(screen.getByLabelText("Yeni e-posta").closest("form")!).getByRole("button", {
      name: "Kodu tekrar gönder",
    }),
  );
  expect(mocks.resend).toHaveBeenCalledWith({
    type: "email_change",
    email: "pending@example.invalid",
    options: { emailRedirectTo: "https://app.example.invalid/auth/callback" },
  });
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.remember).toHaveBeenCalledWith("/account");
});
