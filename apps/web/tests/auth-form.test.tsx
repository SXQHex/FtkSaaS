import { render } from "./render";
import { expect, test, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthFields } from "../src/components/auth/auth-fields";
type AuthResult = Promise<{ error: { code: string } | null }>;
const mocks = vi.hoisted(() => ({
  signIn: vi.fn<(credentials: { email: string; password: string }) => AuthResult>(),
  recover: vi.fn<(email: string, options: { redirectTo: string }) => AuthResult>(),
  signup:
    vi.fn<() => Promise<{ error: { code: string } | null; data: { session: object | null } }>>(),
  update: vi.fn<(values: { password: string }) => AuthResult>(),
  factors:
    vi.fn<() => Promise<{ error: null; data: { totp: { id: string; status: string }[] } }>>(),
  verify: vi.fn<(values: { factorId: string; code: string }) => AuthResult>(),
  replace: vi.fn<(href: string) => void>(),
  refresh: vi.fn<() => void>(),
  remember: vi.fn<() => Promise<void>>(),
  oauth: vi.fn<() => AuthResult>(),
}));
vi.mock("../src/lib/auth-return", () => ({ rememberAuthReturn: mocks.remember }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      signInWithPassword: mocks.signIn,
      resetPasswordForEmail: mocks.recover,
      signUp: mocks.signup,
      updateUser: mocks.update,
      signInWithOAuth: mocks.oauth,
      mfa: { listFactors: mocks.factors, challengeAndVerify: mocks.verify },
    },
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "http://127.0.0.1:3000");
});

test("signup sends only profile data and waits for email confirmation without inventing a session", async () => {
  mocks.signup.mockResolvedValue({ error: null, data: { session: null } });
  const user = userEvent.setup();
  render(<AuthFields mode="signup" />);
  await user.type(screen.getByLabelText("Ad soyad"), "Test Üyesi");
  await user.type(screen.getByLabelText("E-posta adresi"), "test@example.invalid");
  await user.type(screen.getByLabelText("Parola", { exact: true }), "synthetic-password");
  await user.type(screen.getByLabelText("Yeni parolayı tekrar yaz"), "synthetic-password");
  await user.click(screen.getByRole("button", { name: "Hesap oluştur" }));
  expect(await screen.findByRole("heading", { name: "E-postanı kontrol et" })).toBeVisible();
  expect(mocks.signup).toHaveBeenCalledWith({
    email: "test@example.invalid",
    password: "synthetic-password",
    options: {
      data: { display_name: "Test Üyesi" },
      emailRedirectTo: "http://127.0.0.1:3000/auth/callback",
    },
  });
  expect(mocks.replace).not.toHaveBeenCalled();
});
test("mismatched signup passwords do not call the provider", async () => {
  const user = userEvent.setup();
  render(<AuthFields mode="signup" />);
  await user.type(screen.getByLabelText("Ad soyad"), "Test");
  await user.type(screen.getByLabelText("E-posta adresi"), "test@example.invalid");
  await user.type(screen.getByLabelText("Parola", { exact: true }), "synthetic-password");
  await user.type(screen.getByLabelText("Yeni parolayı tekrar yaz"), "different-password");
  await user.click(screen.getByRole("button", { name: "Hesap oluştur" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Parolalar eşleşmiyor");
  expect(mocks.signup).not.toHaveBeenCalled();
});
test("password update errors remain errors in the new layout", async () => {
  mocks.update.mockResolvedValue({ error: { code: "weak_password" } });
  const user = userEvent.setup();
  render(<AuthFields mode="update" />);
  await user.type(screen.getByLabelText("Yeni parola", { exact: true }), "synthetic-password");
  await user.type(screen.getByLabelText("Yeni parolayı tekrar yaz"), "synthetic-password");
  await user.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("yeterince güçlü değil");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
test("TOTP verification uses a verified native factor and does not enter on an invalid code", async () => {
  mocks.factors.mockResolvedValue({
    error: null,
    data: { totp: [{ id: "factor", status: "verified" }] },
  });
  mocks.verify.mockResolvedValue({ error: { code: "mfa_verification_failed" } });
  const user = userEvent.setup();
  render(<AuthFields mode="mfa" />);
  await user.type(screen.getByLabelText("Doğrulama kodu"), "123456");
  await user.click(screen.getByRole("button", { name: "Doğrula" }));
  expect(mocks.verify).toHaveBeenCalledWith({ factorId: "factor", code: "123456" });
  expect(await screen.findByRole("alert")).toHaveTextContent("Doğrulama kodu hatalı");
  expect(mocks.replace).not.toHaveBeenCalled();
});
test("failed native login shows an error and never redirects as success", async () => {
  mocks.signIn.mockResolvedValue({ error: { code: "invalid_credentials" } });
  const user = userEvent.setup();
  render(<AuthFields />);
  await user.type(screen.getByLabelText("E-posta adresi"), "test@example.invalid");
  await user.type(screen.getByLabelText("Parola"), "synthetic-password");
  await user.click(screen.getByRole("button", { name: "Giriş yap" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("E-posta veya parola hatalı");
  expect(mocks.replace).not.toHaveBeenCalled();
});
test("successful native login refreshes server-rendered session", async () => {
  mocks.signIn.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(<AuthFields />);
  await user.type(screen.getByLabelText("E-posta adresi"), "test@example.invalid");
  await user.type(screen.getByLabelText("Parola"), "synthetic-password");
  await user.click(screen.getByRole("button", { name: "Giriş yap" }));
  expect(mocks.replace).toHaveBeenCalledWith("/");
  expect(mocks.refresh).toHaveBeenCalled();
});
test("login returns to a safe session link and rejects external destinations", async () => {
  mocks.signIn.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  for (const destination of ["/organizasyon/org/seans/session", "//attacker.invalid"]) {
    const view = render(<AuthFields returnTo={destination} />);
    await user.type(screen.getByLabelText("E-posta adresi"), "test@example.invalid");
    await user.type(screen.getByLabelText("Parola"), "synthetic-password");
    await user.click(screen.getByRole("button", { name: "Giriş yap" }));
    expect(mocks.replace).toHaveBeenLastCalledWith(
      destination.startsWith("//") ? "/" : destination,
    );
    view.unmount();
  }
});
test("Google preserves the local destination without changing the provider callback URL", async () => {
  mocks.oauth.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(<AuthFields returnTo="/organizasyon/org/seans/session" />);
  await user.click(screen.getByRole("button", { name: "Google ile devam et" }));
  expect(mocks.remember).toHaveBeenCalledWith("/organizasyon/org/seans/session");
  expect(mocks.oauth).toHaveBeenCalledWith({
    provider: "google",
    options: { redirectTo: "http://127.0.0.1:3000/auth/callback" },
  });
});
test("successful TOTP verification keeps the session destination", async () => {
  mocks.factors.mockResolvedValue({
    error: null,
    data: { totp: [{ id: "factor", status: "verified" }] },
  });
  mocks.verify.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(<AuthFields mode="mfa" returnTo="/organizasyon/org/seans/session" />);
  await user.type(screen.getByLabelText("Doğrulama kodu"), "123456");
  await user.click(screen.getByRole("button", { name: "Doğrula" }));
  expect(mocks.replace).toHaveBeenCalledWith("/organizasyon/org/seans/session");
});
test("recovery request uses native callback and an enumeration-safe response", async () => {
  mocks.recover.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(<AuthFields mode="recovery" />);
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
  render(<AuthFields />, "en");
  await user.type(screen.getByLabelText("Email address"), "test@example.invalid");
  await user.type(screen.getByLabelText("Password"), "synthetic-password");
  await user.click(screen.getByRole("button", { name: /^Sign in$/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
  expect(mocks.replace).not.toHaveBeenCalled();
});
