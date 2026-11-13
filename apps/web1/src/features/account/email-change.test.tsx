import "../../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { AccountIdentityView } from "../../lib/api-contracts/generated";
const { request, resend } = vi.hoisted(() => ({ request: vi.fn(), resend: vi.fn() }));
vi.mock("./email", () => ({ requestEmailChange: request, resendEmailChange: resend }));
import { EmailChange } from "./email-change";
afterEach(() => vi.resetAllMocks());
const identity: AccountIdentityView = {
  given_name: null,
  family_name: null,
  email: "current@example.invalid",
  phone: null,
  pending_email: null,
  pending_phone: null,
  email_verified_at: "2026-11-13T00:00:00Z",
  phone_verified_at: null,
  unverified_phone: null,
};
it("requires a fresh canonical identity before any credential request", async () => {
  const refresh = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(identity);
  render(<EmailChange disabled={false} onRefresh={refresh} />);
  await userEvent.click(screen.getByRole("button", { name: "E-postayı değiştir" }));
  await screen.findByText("Profil bilgileri okunamadı.", { exact: false });
  expect(screen.queryByLabelText("Yeni e-posta")).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  expect(await screen.findByLabelText("Güncel e-posta")).toHaveValue(identity.email);
});
it("keeps current email separate from pending and retries only reads after an acknowledged request", async () => {
  request.mockResolvedValue(undefined);
  const pending = { ...identity, pending_email: "next@example.invalid" };
  const refresh = vi
    .fn()
    .mockResolvedValueOnce(identity)
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(pending);
  render(<EmailChange disabled={false} onRefresh={refresh} />);
  await userEvent.click(screen.getByRole("button", { name: "E-postayı değiştir" }));
  await userEvent.type(await screen.findByLabelText("Yeni e-posta"), "next@example.invalid");
  await userEvent.click(screen.getByRole("button", { name: "Değişim isteği gönder" }));
  await screen.findByText("İstek işlendi. Güncel hesap bilgileri yenilenemedi.");
  expect(screen.getByRole("button", { name: "Değişim isteği gönder" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  expect(await screen.findByLabelText("Güncel e-posta")).toHaveValue("current@example.invalid");
  expect(screen.getByLabelText("Bekleyen e-posta")).toHaveValue("next@example.invalid");
  expect(request).toHaveBeenCalledExactlyOnceWith("next@example.invalid");
});
it("resends only the canonical pending address, preserves denial and stops portal form submission", async () => {
  const pending = { ...identity, pending_email: "pending@example.invalid" };
  const refresh = vi.fn().mockResolvedValue(pending);
  const outerSubmit = vi.fn((event) => event.preventDefault());
  request.mockRejectedValue(new Error("native denial"));
  resend.mockResolvedValue(undefined);
  render(
    <form onSubmit={outerSubmit}>
      <EmailChange disabled={false} onRefresh={refresh} />
    </form>,
  );
  await userEvent.click(screen.getByRole("button", { name: "E-postayı değiştir" }));
  await userEvent.type(await screen.findByLabelText("Yeni e-posta"), "another@example.invalid");
  await userEvent.click(screen.getByRole("button", { name: "Değişim isteği gönder" }));
  await screen.findByText("E-posta işlemi doğrulanamadı.", { exact: false });
  expect(screen.getByLabelText("Yeni e-posta")).toHaveValue("another@example.invalid");
  expect(outerSubmit).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Bekleyen adrese yeniden gönder" }));
  await waitFor(() => expect(resend).toHaveBeenCalledExactlyOnceWith("pending@example.invalid"));
  expect(outerSubmit).not.toHaveBeenCalled();
});
