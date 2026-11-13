import "../../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
const { verify, next, navigate, state } = vi.hoisted(() => ({
  verify: vi.fn(),
  next: vi.fn(),
  navigate: vi.fn(),
  state: { factors: [{ id: "first", friendly_name: "Phone" }] },
}));
vi.mock("./mfa", () => ({ verifyTotp: verify, continueAfterMfa: next }));
vi.mock("@tanstack/react-router", () => ({
  useLoaderData: () => state.factors,
  useNavigate: () => navigate,
  useRouter: () => ({ invalidate: vi.fn() }),
}));
import { MfaPage } from "./mfa-page";
afterEach(() => {
  vi.resetAllMocks();
  state.factors = [{ id: "first", friendly_name: "Phone" }];
});
it("validates six digits and preserves the protected destination on native denial", async () => {
  verify.mockRejectedValue(new Error("denied"));
  render(<MfaPage />);
  const code = screen.getByLabelText("Doğrulama kodu");
  await userEvent.type(code, "123");
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }));
  expect(await screen.findByText("6 haneli doğrulama kodunu gir.")).toBeVisible();
  expect(verify).not.toHaveBeenCalled();
  await userEvent.type(code, "456");
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }));
  expect(await screen.findByText("Kod doğrulanamadı. Güncel kodla yeniden dene.")).toBeVisible();
  expect(next).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
});
it("retries the account read after verified TOTP without submitting the code again", async () => {
  verify.mockResolvedValue(undefined);
  next.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce("/reset-password");
  render(<MfaPage />);
  await userEvent.type(screen.getByLabelText("Doğrulama kodu"), "123456");
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }));
  expect(
    await screen.findByText("Kod doğrulandı. Hesap bilgileri yenilenemedi. Yeniden dene."),
  ).toBeVisible();
  expect(screen.queryByLabelText("Doğrulama kodu")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/reset-password", replace: true }),
  );
  expect(verify).toHaveBeenCalledExactlyOnceWith("first", "123456");
});
it("requires explicit selection when several verified TOTP factors exist", async () => {
  state.factors.push({ id: "second", friendly_name: "Tablet" });
  verify.mockResolvedValue(undefined);
  next.mockResolvedValue("/account");
  render(<MfaPage />);
  await userEvent.type(screen.getByLabelText("Doğrulama kodu"), "123456");
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }));
  expect(
    await screen.findByText("Doğrulama uygulamasını seç.", {
      selector: "div[data-slot=field-error]",
    }),
  ).toBeVisible();
  expect(verify).not.toHaveBeenCalled();
  await userEvent.selectOptions(screen.getByLabelText("Doğrulama uygulaması"), "second");
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }));
  await waitFor(() => expect(verify).toHaveBeenCalledExactlyOnceWith("second", "123456"));
});
