import { afterEach, expect, it, vi } from "vitest";
const { update, resend } = vi.hoisted(() => ({ update: vi.fn(), resend: vi.fn() }));
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({ auth: { updateUser: update, resend } }),
}));
import { requestEmailChange, resendEmailChange } from "./email";
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("requests native email change with an explicit configured callback and no profile metadata write", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  update.mockResolvedValue({ data: { user: { id: "native-user" } }, error: null });
  await requestEmailChange(" new@example.invalid ");
  expect(update).toHaveBeenCalledWith(
    { email: "new@example.invalid" },
    { emailRedirectTo: "https://app.example.invalid/auth/callback" },
  );
  expect(resend).not.toHaveBeenCalled();
});
it("resends only the explicit native pending target without claiming confirmation", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  resend.mockResolvedValue({ data: { user: null, session: null }, error: null });
  await resendEmailChange("pending@example.invalid");
  expect(resend).toHaveBeenCalledWith({
    type: "email_change",
    email: "pending@example.invalid",
    options: { emailRedirectTo: "https://app.example.invalid/auth/callback" },
  });
  expect(update).not.toHaveBeenCalled();
});
it("preserves provider rejection and does not send when callback configuration is absent", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "");
  await expect(requestEmailChange("new@example.invalid")).rejects.toThrow("APP_ORIGIN_REQUIRED");
  expect(update).not.toHaveBeenCalled();
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  const error = new Error("native denial");
  update.mockResolvedValue({ data: { user: null }, error });
  await expect(requestEmailChange("new@example.invalid")).rejects.toBe(error);
});
