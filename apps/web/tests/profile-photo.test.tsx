import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { AccountWorkspace } from "../src/components/account/account-workspace";
import { accountStorageKey } from "../src/components/account/account-command";
import { ApiFailure } from "../src/lib/api";

const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
  read: vi.fn<() => Promise<{ account: AccountView; version: number }>>(),
  router: { replace: vi.fn<(path: string) => void>(), refresh: vi.fn<() => void>() },
}));
vi.mock("../src/lib/account", async (load) => ({
  ...(await load<typeof import("../src/lib/account")>()),
  accountCall: mocks.call,
  accountProfile: mocks.read,
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  }),
}));
vi.mock("../src/components/preferences", () => ({ Preferences: () => null }));
vi.mock("../src/components/account/identity-form", () => ({
  IdentityForm: ({ onSaved }: { onSaved: () => void }) => (
    <button onClick={onSaved}>Synthetic account refresh</button>
  ),
}));
vi.mock("../src/components/account/session-manager", () => ({ SessionManager: () => null }));
vi.mock("../src/components/account/mfa-manager", () => ({ MfaManager: () => null }));
vi.mock("../src/components/account/google-link", () => ({ GoogleLink: () => null }));
vi.mock("../src/components/account/account-delete", () => ({ AccountDelete: () => null }));

const actor = "019a2b3c-4d5e-7000-8000-000000000001";
const asset = {
  id: "019a2b3c-4d5e-7000-8000-000000000002",
  mime: "image/png" as const,
  bytes: 3,
  checksum: "a".repeat(64),
};
const profile: AccountView = {
  id: actor,
  state: "active",
  display_name: "Synthetic Person",
  identity: {
    email: "synthetic@example.invalid",
    email_verified_at: null,
    phone_verified_at: null,
    pending_email: null,
    phone: null,
    pending_phone: null,
    unverified_phone: null,
    given_name: null,
    family_name: null,
  },
};
const image = () => screen.getByRole("img", { name: "Profil fotoğrafı" });
const choose = () => screen.getByLabelText("Fotoğrafı değiştir", { selector: "input" });
const edit = () => screen.getByRole("button", { name: "Fotoğrafı değiştir" });
const remove = () => screen.getByRole("button", { name: "Fotoğrafı kaldır" });
const save = () => screen.getByRole("button", { name: "Profili kaydet" });
function file() {
  const value = new File(["png"], "synthetic.png", { type: "image/png" });
  Object.defineProperty(value, "arrayBuffer", {
    value: async () => new TextEncoder().encode("png").buffer,
  });
  return value;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function open(account = profile, version = 7) {
  mocks.read.mockResolvedValue({ account, version });
  const view = render(<AccountWorkspace authUserId="synthetic-native-user" />);
  await screen.findByLabelText("Görünen ad");
  return view;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  sessionStorage.clear();
  mocks.call.mockImplementation(async (operation) =>
    operation === "media_get_v1" ? { asset, data_base64: "cG5n" } : {},
  );
});
afterEach(() => vi.unstubAllGlobals());

test("selection saves only the photo, preserves drafts through refresh and serializes profile writes", async () => {
  const user = userEvent.setup();
  await open();
  expect(image()).toHaveAttribute("src", "/images/default-profile.svg");
  expect(remove()).toBeDisabled();
  await user.clear(screen.getByLabelText("Görünen ad"));
  await user.type(screen.getByLabelText("Görünen ad"), "Unsaved draft");
  await user.type(screen.getByLabelText("Doğrulanmamış telefon"), "invalid draft");
  const write = deferred<unknown>();
  const read = deferred<{ account: AccountView; version: number }>();
  mocks.call.mockReturnValueOnce(write.promise);
  mocks.read.mockReturnValueOnce(read.promise);
  await user.upload(choose(), file());
  expect(screen.getByRole("status")).toHaveTextContent("Yükleniyor");
  expect(edit()).toBeDisabled();
  expect(save()).toBeDisabled();
  await user.click(save());
  await waitFor(() => expect(mocks.call).toHaveBeenCalledTimes(1));
  expect(mocks.call.mock.calls[0]).toEqual([
    "account_profile_update_v1",
    {
      operation_key: expect.any(String),
      expected_version: 7,
      display_name: profile.display_name,
      photo: {
        mime: "image/png",
        data_base64: "cG5n",
        checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    },
  ]);
  await act(async () => write.resolve({}));
  expect(screen.getByRole("status")).toHaveTextContent("Fotoğraf kaydedildi.");
  expect(image()).toHaveAttribute("src", "data:image/png;base64,cG5n");
  expect(save()).toBeDisabled();
  await act(async () => read.resolve({ account: { ...profile, photo: asset }, version: 8 }));
  expect(save()).toBeEnabled();
  expect(screen.getByLabelText("Görünen ad")).toHaveValue("Unsaved draft");
  expect(screen.getByLabelText("Doğrulanmamış telefon")).toHaveValue("invalid draft");
  await user.clear(screen.getByLabelText("Doğrulanmamış telefon"));
  await user.type(screen.getByLabelText("Doğrulanmamış telefon"), "0555 123 45 67");
  mocks.read.mockResolvedValue({ account: { ...profile, photo: asset }, version: 9 });
  await user.click(save());
  const writes = mocks.call.mock.calls.filter(
    ([operation]) => operation === "account_profile_update_v1",
  );
  expect(writes).toHaveLength(2);
  expect(writes[1][1]).toMatchObject({
    expected_version: 8,
    display_name: "Unsaved draft",
    unverified_phone: "+905551234567",
  });
  expect(writes[1][1]).not.toHaveProperty("photo");
  expect(screen.getByLabelText("Doğrulanmamış telefon")).toHaveValue("+905551234567");
});

test("removal commits immediately and returns to the supplied default after reload", async () => {
  const user = userEvent.setup();
  const view = await open({ ...profile, photo: asset });
  await waitFor(() => expect(image()).toHaveAttribute("src", "data:image/png;base64,cG5n"));
  const write = deferred<unknown>();
  mocks.call.mockReturnValueOnce(write.promise);
  mocks.read.mockResolvedValue({ account: { ...profile, photo: null }, version: 8 });
  await user.click(remove());
  expect(screen.getByRole("status")).toHaveTextContent("Kaldırılıyor");
  expect(mocks.call).toHaveBeenLastCalledWith("account_profile_update_v1", {
    operation_key: expect.any(String),
    expected_version: 7,
    display_name: profile.display_name,
    photo: null,
  });
  await act(async () => write.resolve({}));
  expect(await screen.findByText("Fotoğraf kaldırıldı.")).toBeVisible();
  expect(image()).toHaveAttribute("src", "/images/default-profile.svg");
  expect(remove()).toBeDisabled();
  view.unmount();
  await open({ ...profile, photo: null }, 8);
  expect(image()).toHaveAttribute("src", "/images/default-profile.svg");
});

test("uncertain photo upload survives reload and replays exactly once with its original key and bytes", async () => {
  const user = userEvent.setup();
  const view = await open();
  mocks.call.mockRejectedValueOnce(new Error("lost response"));
  await user.upload(choose(), file());
  expect(await screen.findByText(/Sonuç belirsiz/)).toBeVisible();
  expect(image()).toHaveAttribute("src", "/images/default-profile.svg");
  expect(save()).toBeDisabled();
  const original = mocks.call.mock.calls[0];
  view.unmount();
  await open({ ...profile, photo: asset }, 8);
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(edit()).toBeEnabled());
  const writes = mocks.call.mock.calls.filter(
    ([operation]) => operation === "account_profile_update_v1",
  );
  expect(writes).toEqual([original, original]);
  expect(screen.getByText("Fotoğraf kaydedildi.")).toBeVisible();
  // An idempotent replay need not increment the already-current account version.
  expect(sessionStorage.getItem(accountStorageKey(actor, "profile"))).toBeNull();
});

test("failed post-commit refresh keeps drafts and blocks writes until a successful re-read", async () => {
  const user = userEvent.setup();
  await open();
  await user.type(screen.getByLabelText("Görünen ad"), " draft");
  mocks.read.mockRejectedValueOnce(new Error("read failed"));
  await user.upload(choose(), file());
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Görünen ad")).toHaveValue("Synthetic Person draft");
  expect(save()).toBeDisabled();
  mocks.read.mockResolvedValue({ account: { ...profile, photo: asset }, version: 8 });
  await user.click(screen.getByRole("button", { name: "Yeniden dene" }));
  await waitFor(() => expect(save()).toBeEnabled());
  expect(screen.getByLabelText("Görünen ad")).toHaveValue("Synthetic Person draft");
});

test("another account refresh during upload cannot unlock writes before the post-commit read", async () => {
  const user = userEvent.setup();
  await open();
  const write = deferred<unknown>();
  mocks.call.mockReturnValueOnce(write.promise);
  await user.upload(choose(), file());
  await waitFor(() => expect(mocks.call).toHaveBeenCalledTimes(1));
  await user.click(screen.getByRole("button", { name: "Synthetic account refresh" }));
  await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
  const afterCommit = deferred<{ account: AccountView; version: number }>();
  mocks.read.mockReturnValueOnce(afterCommit.promise);
  await act(async () => write.resolve({}));
  expect(save()).toBeDisabled();
  expect(edit()).toBeDisabled();
  await act(async () => afterCommit.resolve({ account: { ...profile, photo: asset }, version: 8 }));
  expect(save()).toBeEnabled();
});

test("refresh updates untouched profile fields but preserves edited drafts", async () => {
  const user = userEvent.setup();
  await open();
  await user.type(screen.getByLabelText("Ad"), "Local draft");
  mocks.read.mockResolvedValue({
    account: {
      ...profile,
      display_name: "Updated elsewhere",
      identity: { ...profile.identity!, given_name: "Remote", family_name: "New surname" },
    },
    version: 8,
  });
  await user.click(screen.getByRole("button", { name: "Synthetic account refresh" }));
  await waitFor(() => expect(screen.getByLabelText("Görünen ad")).toHaveValue("Updated elsewhere"));
  expect(screen.getByLabelText("Ad")).toHaveValue("Local draft");
  expect(screen.getByLabelText("Soyad")).toHaveValue("New surname");
});

test("a rejected removal leaves the saved photo intact and allows a new attempt", async () => {
  const user = userEvent.setup();
  await open({ ...profile, photo: asset });
  await waitFor(() => expect(image()).toHaveAttribute("src", "data:image/png;base64,cG5n"));
  mocks.call.mockRejectedValueOnce(
    new ApiFailure({ ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: actor } }),
  );
  await user.click(remove());
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByText("Fotoğraf kaldırıldı.")).not.toBeInTheDocument();
  expect(image()).toHaveAttribute("src", "data:image/png;base64,cG5n");
  expect(remove()).toBeEnabled();
  expect(sessionStorage.getItem(accountStorageKey(actor, "profile"))).toBeNull();
});

test("lost removal can be confirmed by status without sending a second mutation", async () => {
  const user = userEvent.setup();
  await open({ ...profile, photo: asset });
  await waitFor(() => expect(image()).toHaveAttribute("src", "data:image/png;base64,cG5n"));
  mocks.call.mockRejectedValueOnce(new Error("lost response"));
  await user.click(remove());
  await screen.findByText(/Sonuç belirsiz/);
  expect(image()).toHaveAttribute("src", "data:image/png;base64,cG5n");
  mocks.call.mockResolvedValueOnce({ status: "succeeded", result_reference: null });
  mocks.read.mockResolvedValue({ account: { ...profile, photo: null }, version: 8 });
  await user.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  expect(await screen.findByText("Fotoğraf kaldırıldı.")).toBeVisible();
  expect(image()).toHaveAttribute("src", "/images/default-profile.svg");
  expect(
    mocks.call.mock.calls.filter(([operation]) => operation === "account_profile_update_v1"),
  ).toHaveLength(1);
});

test("access loss during refresh clears the old account rather than preserving drafts", async () => {
  const user = userEvent.setup();
  await open();
  mocks.read.mockRejectedValueOnce(
    new ApiFailure({ ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: actor } }),
  );
  await user.upload(choose(), file());
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("Görünen ad")).not.toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test.each([
  new File(["svg"], "unsafe.svg", { type: "image/svg+xml" }),
  new File([new Uint8Array(1048577)], "large.png", { type: "image/png" }),
  new File([], "empty.png", { type: "image/png" }),
])("invalid file $name never starts a write or replaces the default", async (invalid) => {
  const user = userEvent.setup({ applyAccept: false });
  await open();
  await user.upload(choose(), invalid);
  expect(await screen.findByRole("alert")).toHaveTextContent("PNG, JPEG veya WebP");
  expect(mocks.call).not.toHaveBeenCalled();
  expect(image()).toHaveAttribute("src", "/images/default-profile.svg");
  expect(edit()).toBeEnabled();
});

test("private media read failure can be retried without losing the remove action", async () => {
  mocks.call.mockRejectedValueOnce(new Error("media unavailable"));
  await open({ ...profile, photo: asset });
  const user = userEvent.setup();
  expect(await screen.findByRole("alert")).toHaveTextContent("Fotoğraf yüklenemedi.");
  expect(remove()).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Fotoğrafı yeniden yükle" }));
  await waitFor(() => expect(image()).toHaveAttribute("src", "data:image/png;base64,cG5n"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(mocks.call.mock.calls.every(([operation]) => operation === "media_get_v1")).toBe(true);
});
