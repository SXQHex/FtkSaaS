import "../../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { ProfileSnapshot } from "./profile";
const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("./profile", async (original) => ({
  ...(await original<typeof import("./profile")>()),
  saveProfile: save,
}));
import { BackendError } from "../../lib/backend";
import { ProfileForm } from "./profile-panel";
afterEach(() => vi.resetAllMocks());
const id = "019a7b00-0000-7000-8000-000000000001";
const base: ProfileSnapshot = {
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
