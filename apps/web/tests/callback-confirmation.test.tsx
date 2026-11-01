import { StrictMode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "./render";
import { CallbackConfirmation } from "../src/components/auth/callback-confirmation";

const message =
  "Confirmation link accepted. Please proceed to confirm link sent to the other email";
const client = vi.fn<() => void>();
vi.mock("../src/lib/supabase/client", () => ({ browserClient: () => client() }));
afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.clearAllMocks();
});

test("a native first-confirmation hint only explains the second step, without authenticating", () => {
  window.history.replaceState(
    { navigation: "preserved" },
    "",
    `/auth/confirmation#${new URLSearchParams({ message, sb: "" })}`,
  );
  render(
    <StrictMode>
      <CallbackConfirmation returnTo="/account" />
    </StrictMode>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Diğer adrese gönderilen bağlantıyı da aç");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Hesap ve güvenlik" })).toHaveAttribute(
    "href",
    "/account",
  );
  expect(client).not.toHaveBeenCalled();
  expect(window.location.hash).toBe("");
  expect(window.history.state).toEqual({ navigation: "preserved" });
});

test.each([
  "",
  "#message=unrecognized",
  `#${new URLSearchParams({ message, error: "access_denied" })}`,
  `#${new URLSearchParams({ message, error_code: "otp_expired" })}`,
  `#${new URLSearchParams({ message, error_description: "" })}`,
  "#access_token=synthetic&refresh_token=synthetic",
])("missing, unknown, expired or conflicting proof remains an error (%s)", (hash) => {
  window.history.replaceState(null, "", `/auth/confirmation${hash}`);
  render(<CallbackConfirmation returnTo="/account" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Bağlantı doğrulanamadı");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Giriş ekranına dön" })).toHaveAttribute(
    "href",
    "/login?next=%2Faccount",
  );
  expect(client).not.toHaveBeenCalled();
  expect(window.location.hash).toBe("");
});

test("an untrusted return path never becomes an external recovery link", () => {
  render(<CallbackConfirmation returnTo="//attacker.invalid" />);
  expect(screen.getByRole("link", { name: "Giriş ekranına dön" })).toHaveAttribute(
    "href",
    "/login",
  );
});
