import { AuthApiError, type UserIdentity } from "@supabase/supabase-js";
import { beforeEach, expect, test, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { GoogleLink } from "../src/components/account/google-link";
const mocks = vi.hoisted(() => ({
  identities: vi.fn<() => Promise<{ data: { identities: UserIdentity[] }; error: Error | null }>>(),
  link: vi.fn<() => Promise<{ error: Error | null }>>(),
  unlink: vi.fn<() => Promise<{ error: Error | null }>>(),
  refresh: vi.fn<() => Promise<{ error: Error | null }>>(),
  remember: vi.fn<() => Promise<void>>(),
  saved: vi.fn<() => void>(),
}));
vi.mock("../src/lib/auth-return", () => ({ rememberAuthReturn: mocks.remember }));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getUserIdentities: mocks.identities,
      linkIdentity: mocks.link,
      unlinkIdentity: mocks.unlink,
      refreshSession: mocks.refresh,
    },
  }),
}));
const identity: UserIdentity = {
  id: "google-subject",
  identity_id: "native-identity",
  user_id: "native-user",
  provider: "google",
  identity_data: { email: "linked@example.invalid" },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "https://app.example.invalid");
  mocks.identities.mockResolvedValue({ data: { identities: [] }, error: null });
  mocks.link.mockResolvedValue({ error: null });
  mocks.unlink.mockResolvedValue({ error: null });
  mocks.refresh.mockResolvedValue({ error: null });
});
test("Google linking uses native OAuth without a GIS client ID, token, or backend prepare", async () => {
  const user = userEvent.setup();
  render(<GoogleLink actorId="actor" />);
  const button = await screen.findByRole("button", { name: "Google hesabını bağla" });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  expect(mocks.remember).toHaveBeenCalledWith("/account");
  expect(mocks.link).toHaveBeenCalledExactlyOnceWith({
    provider: "google",
    options: { redirectTo: "https://app.example.invalid/auth/callback" },
  });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
test("native linking failure stays an error", async () => {
  mocks.link.mockResolvedValue({ error: new Error("provider rejected") });
  const user = userEvent.setup();
  render(<GoogleLink actorId="actor" />);
  const button = await screen.findByRole("button", { name: "Google hesabını bağla" });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("Kimlik sağlayıcısı");
  expect(button).toBeEnabled();
});
test("an existing Google identity shows its removal action without offering another link", async () => {
  mocks.identities.mockResolvedValue({ data: { identities: [identity] }, error: null });
  render(<GoogleLink actorId="actor" />);
  expect(await screen.findByText("linked@example.invalid")).toBeVisible();
  expect(screen.getByRole("button", { name: "Google bağlantısını kaldır" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Google hesabını bağla" })).not.toBeInTheDocument();
});
test("loading or failed identity reads never offer Google linking", async () => {
  mocks.identities.mockRejectedValue(new Error("unavailable"));
  render(<GoogleLink actorId="actor" />);
  expect(screen.queryByRole("button", { name: "Google hesabını bağla" })).not.toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("Kimlik sağlayıcısı");
  expect(screen.queryByRole("button", { name: "Google hesabını bağla" })).not.toBeInTheDocument();
});
test("a failed retry discards an earlier empty identity list instead of offering stale linking", async () => {
  let rejectRetry!: (cause: Error) => void;
  const retry = new Promise<Awaited<ReturnType<typeof mocks.identities>>>((_, reject) => {
    rejectRetry = reject;
  });
  mocks.identities
    .mockResolvedValueOnce({ data: { identities: [] }, error: null })
    .mockReturnValueOnce(retry);
  mocks.link.mockResolvedValue({ error: new Error("provider rejected") });
  const user = userEvent.setup();
  render(<GoogleLink actorId="actor" />);
  await user.click(await screen.findByRole("button", { name: "Google hesabını bağla" }));
  await user.click(await screen.findByRole("button", { name: "Güncelle" }));
  expect(screen.queryByRole("button", { name: "Google hesabını bağla" })).not.toBeInTheDocument();
  await act(async () => rejectRetry(new Error("unavailable")));
  expect(await screen.findByRole("alert")).toHaveTextContent("Kimlik sağlayıcısı");
  expect(screen.queryByRole("button", { name: "Google hesabını bağla" })).not.toBeInTheDocument();
});
test("unlink refreshes native identities and account data only after success", async () => {
  mocks.identities.mockResolvedValueOnce({ data: { identities: [identity] }, error: null });
  const user = userEvent.setup();
  render(<GoogleLink actorId="actor" onSaved={mocks.saved} />);
  await user.click(await screen.findByRole("button", { name: "Google bağlantısını kaldır" }));
  await waitFor(() => expect(screen.queryByText("linked@example.invalid")).not.toBeInTheDocument());
  expect(mocks.unlink).toHaveBeenCalledWith(identity);
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(mocks.saved).toHaveBeenCalledOnce();
  expect(await screen.findByRole("button", { name: "Google hesabını bağla" })).toBeEnabled();
});
test("native last-identity rejection preserves the identity", async () => {
  mocks.identities.mockResolvedValue({ data: { identities: [identity] }, error: null });
  mocks.unlink.mockResolvedValue({
    error: new AuthApiError("last identity", 422, "single_identity_not_deletable"),
  });
  const user = userEvent.setup();
  render(<GoogleLink actorId="actor" onSaved={mocks.saved} />);
  await user.click(await screen.findByRole("button", { name: "Google bağlantısını kaldır" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Son giriş yöntemi kaldırılamaz");
  expect(screen.getByText("linked@example.invalid")).toBeVisible();
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(mocks.saved).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Google hesabını bağla" })).not.toBeInTheDocument();
});
