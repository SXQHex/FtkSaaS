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
test("legacy verified phone remains read-only without SMS enrollment, code or resend controls", () => {
  render(<IdentityForm account={account} onSaved={mocks.saved} />);
  expect(screen.getByText("12025550101")).toBeVisible();
  expect(screen.queryByLabelText("Yeni telefon")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("SMS doğrulama kodu")).not.toBeInTheDocument();
  expect(screen.queryByText("12025550102")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Kodu tekrar gönder" })).not.toBeInTheDocument();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.resend).not.toHaveBeenCalled();
  expect(mocks.saved).not.toHaveBeenCalled();
});
test("an account without native identity still offers email and password changes, never SMS", () => {
  render(
    <IdentityForm
      account={{ id: account.id, state: "active", display_name: "Synthetic" }}
      onSaved={mocks.saved}
    />,
  );
  expect(screen.getByLabelText("Yeni e-posta")).toBeVisible();
  expect(screen.getByText("Parolayı değiştir", { exact: true })).toBeVisible();
  expect(screen.queryByLabelText("Yeni telefon")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("SMS doğrulama kodu")).not.toBeInTheDocument();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.resend).not.toHaveBeenCalled();
  expect(mocks.saved).not.toHaveBeenCalled();
});
test("email update with a legacy pending phone sends only email and retains the native callback", async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "https://app.example.invalid");
  const user = userEvent.setup();
  render(<IdentityForm account={account} onSaved={mocks.saved} />);
  const field = screen.getByLabelText("Yeni e-posta");
  await user.type(field, "new@example.invalid");
  await user.click(
    within(field.closest("form")!).getByRole("button", { name: "Değişikliği başlat" }),
  );
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.update).toHaveBeenCalledExactlyOnceWith(
    { email: "new@example.invalid" },
    { emailRedirectTo: "https://app.example.invalid/auth/callback" },
  );
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.remember).toHaveBeenCalledWith("/account");
  expect(screen.getByText("12025550101")).toBeInTheDocument();
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
