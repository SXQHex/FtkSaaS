import { afterEach, expect, it, vi } from "vitest";
const { update, reauthenticate } = vi.hoisted(() => ({ update: vi.fn(), reauthenticate: vi.fn() }));
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({ auth: { updateUser: update, reauthenticate } }),
}));
import { changePassword, requestPasswordCode } from "./password";
afterEach(() => vi.resetAllMocks());
it("sends current and new passwords directly to native Auth without custom reauthentication", async () => {
  update.mockResolvedValue({ data: { user: { id: "fixture" } }, error: null });
  await changePassword({ current: "current", password: "next", nonce: "" });
  expect(update).toHaveBeenCalledWith({ current_password: "current", password: "next" });
  expect(reauthenticate).not.toHaveBeenCalled();
});
it("propagates native code requirements without automatically sending an email", async () => {
  const error = { code: "reauthentication_needed" };
  update.mockResolvedValue({ data: { user: null }, error });
  await expect(changePassword({ current: "current", password: "next", nonce: "" })).rejects.toBe(
    error,
  );
  expect(reauthenticate).not.toHaveBeenCalled();
});
it("requests a code only explicitly, then sends nonce together with current password", async () => {
  reauthenticate.mockResolvedValue({ error: null });
  await requestPasswordCode();
  expect(reauthenticate).toHaveBeenCalledOnce();
  update.mockResolvedValue({ data: { user: { id: "fixture" } }, error: null });
  await changePassword({ current: "current", password: "next", nonce: "user-code" });
  expect(update).toHaveBeenCalledWith({
    current_password: "current",
    password: "next",
    nonce: "user-code",
  });
});

it("lets native Auth decide current-password requirements when adding the first password", async () => {
  update.mockResolvedValue({ data: { user: { id: "fixture" } }, error: null });
  await changePassword({ current: "", password: "first-password", nonce: "" });
  expect(update).toHaveBeenCalledWith({ password: "first-password" });
});
