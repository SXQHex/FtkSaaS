import "../../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { ProfileSnapshot } from "./profile";
const { save, prepare, emailRequest } = vi.hoisted(() => ({
  save: vi.fn(),
  prepare: vi.fn(),
  emailRequest: vi.fn(),
}));
vi.mock("./profile", async (original) => ({
  ...(await original<typeof import("./profile")>()),
  saveProfile: save,
}));
vi.mock("./profile-photo", async (original) => ({
  ...(await original<typeof import("./profile-photo")>()),
  preparePhoto: prepare,
}));
vi.mock("./email", () => ({ requestEmailChange: emailRequest, resendEmailChange: vi.fn() }));
import { BackendError } from "../../lib/backend";
import { ProfileForm } from "./profile-panel";
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
const id = "019a7b00-0000-7000-8000-000000000001";
const base: ProfileSnapshot = {
  photo: null,
  account: {
    id,
    display_name: "Fixture",
    state: "active",
    identity: {
      given_name: null,
      family_name: null,
      email: "fixture@example.invalid",
      phone: null,
      pending_email: null,
      pending_phone: null,
      email_verified_at: "2026-11-13T00:00:00Z",
      phone_verified_at: null,
      unverified_phone: null,
    },
  },
  version: 7,
  values: { displayName: "Fixture", givenName: "", familyName: "", phone: "" },
};
const next: ProfileSnapshot = {
  ...base,
  version: 8,
  values: { ...base.values, displayName: "Changed" },
};
it("validates the unverified phone separately from native verified contacts", async () => {
  render(<ProfileForm latest={base} onRefresh={vi.fn()} />);
  await userEvent.type(screen.getByLabelText("İletişim telefonu", { exact: false }), "05320000000");
  await userEvent.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
  expect(
    await screen.findByText("Telefonu ülke koduyla ve boşluksuz yaz (ör. +905320000000)."),
  ).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByLabelText("E-posta", { exact: false })).toHaveAttribute("readonly");
});
it("keeps a successful write truthful when the refresh fails and retries only the read", async () => {
  save.mockResolvedValue({ version: 8 });
  const refresh = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(next);
  render(<ProfileForm latest={base} onRefresh={refresh} />);
  const name = screen.getByLabelText("Görünen ad");
  await userEvent.clear(name);
  await userEvent.type(name, "Changed");
  await userEvent.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
  expect(await screen.findByText("Profil kaydedildi. Güncel bilgiler yenilenemedi.")).toBeVisible();
  expect(name).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  await waitFor(() => expect(name).toBeEnabled());
  expect(save).toHaveBeenCalledOnce();
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(name).toHaveValue("Changed");
});
it("keeps the same version and operation intent across uncertain same-payload retries", async () => {
  save.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ version: 8 });
  const refresh = vi.fn().mockResolvedValueOnce(base).mockResolvedValueOnce(next);
  render(<ProfileForm latest={base} onRefresh={refresh} />);
  await userEvent.clear(screen.getByLabelText("Görünen ad"));
  await userEvent.type(screen.getByLabelText("Görünen ad"), "Changed");
  await userEvent.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
  expect(await screen.findByText("Kaydetme doğrulanamadı.", { exact: false })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
});
it("preserves a conflicting draft until the user loads the current snapshot", async () => {
  save.mockRejectedValue(
    new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: id }),
  );
  const refresh = vi.fn().mockResolvedValue(next);
  render(<ProfileForm latest={base} onRefresh={refresh} />);
  const name = screen.getByLabelText("Görünen ad");
  await userEvent.clear(name);
  await userEvent.type(name, "My draft");
  await userEvent.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
  expect(
    await screen.findByText("Profil başka bir yerde değişti.", { exact: false }),
  ).toBeVisible();
  expect(name).toHaveValue("My draft");
  expect(screen.getByRole("button", { name: "Değişiklikleri kaydet" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Güncel verileri yükle" }));
  await waitFor(() => expect(name).toHaveValue("Changed"));
  expect(save).toHaveBeenCalledOnce();
});
it("does not replace an unsaved draft on a background version change", async () => {
  const refresh = vi.fn().mockResolvedValue(next);
  const view = render(<ProfileForm latest={base} onRefresh={refresh} />);
  const name = screen.getByLabelText("Görünen ad");
  await userEvent.clear(name);
  await userEvent.type(name, "My draft");
  view.rerender(<ProfileForm latest={next} onRefresh={refresh} />);
  expect(name).toHaveValue("My draft");
  expect(screen.getByRole("button", { name: "Değişiklikleri kaydet" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Güncel verileri yükle" }));
  await waitFor(() => expect(name).toHaveValue("Changed"));
});

it("keeps a photo draft atomic with text and retries the exact intent until a confirmed read", async () => {
  const create = vi.fn(() => "blob:fixture"),
    revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  const upload = { mime: "image/png", data_base64: "YWJj", checksum: "fixture" };
  prepare.mockResolvedValue(upload);
  save.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ version: 8 });
  const refresh = vi
    .fn()
    .mockResolvedValueOnce(base)
    .mockRejectedValueOnce(new Error("read"))
    .mockResolvedValueOnce(next);
  const view = render(<ProfileForm latest={base} onRefresh={refresh} />);
  await userEvent.upload(
    screen.getByLabelText("Fotoğraf yükle"),
    new File(["abc"], "x.png", { type: "image/png" }),
  );
  await waitFor(() => expect(create).toHaveBeenCalledOnce());
  const name = screen.getByLabelText("Görünen ad");
  await userEvent.clear(name);
  await userEvent.type(name, "Changed");
  await userEvent.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
  expect(await screen.findByText("Kaydetme doğrulanamadı.", { exact: false })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
  expect(await screen.findByText("Profil kaydedildi. Güncel bilgiler yenilenemedi.")).toBeVisible();
  expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
  expect(save.mock.calls[0][0].displayName).toBe("Changed");
  expect(save.mock.calls[0][3]).toEqual(upload);
  expect(screen.getByRole("button", { name: "Fotoğraf yükle" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
  expect(save).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:fixture"));
  view.unmount();
});
it("cancels a pending new photo without making a write", async () => {
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:fixture");
      static revokeObjectURL = vi.fn();
    },
  );
  prepare.mockResolvedValue({ mime: "image/png", data_base64: "YWJj", checksum: "fixture" });
  render(<ProfileForm latest={base} onRefresh={vi.fn()} />);
  await userEvent.upload(
    screen.getByLabelText("Fotoğraf yükle"),
    new File(["abc"], "x.png", { type: "image/png" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Değişiklikleri kaydet" })).toBeEnabled(),
  );
  await userEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
  expect(screen.getByRole("button", { name: "Değişiklikleri kaydet" })).toBeDisabled();
  expect(save).not.toHaveBeenCalled();
});

it("prevents snapshot reset while a selected photo is still being prepared", async () => {
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:fixture");
      static revokeObjectURL = vi.fn();
    },
  );
  let finish!: (value: { mime: string; data_base64: string; checksum: string }) => void;
  prepare.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const refresh = vi.fn().mockResolvedValue(next);
  const view = render(<ProfileForm latest={base} onRefresh={refresh} />);
  await userEvent.upload(
    screen.getByLabelText("Fotoğraf yükle"),
    new File(["abc"], "x.png", { type: "image/png" }),
  );
  view.rerender(<ProfileForm latest={next} onRefresh={refresh} />);
  const load = screen.getByRole("button", { name: "Güncel verileri yükle" });
  expect(load).toBeDisabled();
  await userEvent.click(load);
  expect(refresh).not.toHaveBeenCalled();
  finish({ mime: "image/png", data_base64: "YWJj", checksum: "fixture" });
  await waitFor(() => expect(load).toBeEnabled());
  await userEvent.click(load);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Değişiklikleri kaydet" })).toBeDisabled(),
  );
  expect(screen.getByRole("button", { name: "Kaldır" })).toBeDisabled();
  expect(save).not.toHaveBeenCalled();
});

it("preserves dirty profile text while the email Sheet reads canonical pending state without submitting the profile", async () => {
  emailRequest.mockResolvedValue(undefined);
  const identity = base.account.identity;
  if (!identity) throw new Error("fixture identity missing");
  const pending: ProfileSnapshot = {
    ...base,
    account: { ...base.account, identity: { ...identity, pending_email: "next@example.invalid" } },
  };
  const refresh = vi.fn().mockResolvedValueOnce(base).mockResolvedValueOnce(pending);
  render(<ProfileForm latest={base} onRefresh={refresh} />);
  const name = screen.getByLabelText("Görünen ad");
  await userEvent.clear(name);
  await userEvent.type(name, "My draft");
  await userEvent.click(screen.getByRole("button", { name: "E-postayı değiştir" }));
  await userEvent.type(await screen.findByLabelText("Yeni e-posta"), "next@example.invalid");
  await userEvent.click(screen.getByRole("button", { name: "Değişim isteği gönder" }));
  expect(await screen.findByLabelText("Bekleyen e-posta")).toHaveValue("next@example.invalid");
  expect(emailRequest).toHaveBeenCalledExactlyOnceWith("next@example.invalid");
  expect(save).not.toHaveBeenCalled();
  await userEvent.click(screen.getByLabelText("Kapat"));
  expect(name).toHaveValue("My draft");
  expect(screen.getByRole("button", { name: "Değişiklikleri kaydet" })).toBeEnabled();
});
