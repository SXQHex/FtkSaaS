import { render } from "./render";
import { expect, test, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "../src/components/auth-form";
const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  recover: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: { signInWithPassword: mocks.signIn, resetPasswordForEmail: mocks.recover },
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "http://127.0.0.1:3000");
});
test("failed native login shows an error and never redirects as success", async () => {
  mocks.signIn.mockResolvedValue({ error: { code: "invalid_credentials" } });
  const user = userEvent.setup();
  render(<AuthForm />);
  await user.type(screen.getByLabelText("E-posta adresi"), "test@example.invalid");
  await user.type(screen.getByLabelText("Parola"), "synthetic-password");
  await user.click(screen.getByRole("button", { name: "Giriş yap" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("E-posta veya parola hatalı");
  expect(mocks.replace).not.toHaveBeenCalled();
});
test("successful native login refreshes server-rendered session", async () => {
  mocks.signIn.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(<AuthForm />);
  await user.type(screen.getByLabelText("E-posta adresi"), "test@example.invalid");
  await user.type(screen.getByLabelText("Parola"), "synthetic-password");
  await user.click(screen.getByRole("button", { name: "Giriş yap" }));
  expect(mocks.replace).toHaveBeenCalledWith("/");
  expect(mocks.refresh).toHaveBeenCalled();
});
test("recovery request uses native callback and an enumeration-safe response", async () => {
  mocks.recover.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(<AuthForm mode="recovery" />);
  await user.type(screen.getByLabelText("E-posta adresi"), "test@example.invalid");
  await user.click(screen.getByRole("button", { name: "Yenileme bağlantısı gönder" }));
  expect(await screen.findByRole("status")).toHaveTextContent("eşleşen bir hesap varsa");
  expect(mocks.recover).toHaveBeenCalledWith("test@example.invalid", {
    redirectTo: "http://127.0.0.1:3000/auth/callback?next=/parola-yenile",
  });
});

test("English login translates provider errors without reporting success", async () => {
  mocks.signIn.mockResolvedValue({ error: { code: "invalid_credentials" } });
  const user = userEvent.setup();
  render(<AuthForm />, "en");
  await user.type(screen.getByLabelText("Email address"), "test@example.invalid");
  await user.type(screen.getByLabelText("Password"), "synthetic-password");
  await user.click(screen.getByRole("button", { name: /^Sign in$/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
  expect(mocks.replace).not.toHaveBeenCalled();
});
