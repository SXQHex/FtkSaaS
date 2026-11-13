import { expect, it, vi } from "vitest";
const { resend } = vi.hoisted(() => ({ resend: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: { resend } }) }));
import { resendVerification } from "./verification";
it("requests explicit native signup confirmation with the configured callback", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  resend.mockResolvedValue({ data: {}, error: null });
  try {
    await resendVerification("fixture@example.invalid");
    expect(resend).toHaveBeenCalledExactlyOnceWith({
      type: "signup",
      email: "fixture@example.invalid",
      options: { emailRedirectTo: "https://app.example.invalid/auth/callback" },
    });
  } finally {
    vi.unstubAllEnvs();
  }
});
