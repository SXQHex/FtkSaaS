import { afterEach, expect, it, vi } from "vitest";
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn(() => ({ auth: {} })) }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  createClient.mockClear();
});
it("uses a single native PKCE client without automatic URL exchange", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://auth.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  const { getSupabaseClient } = await import("./supabase");
  expect(getSupabaseClient()).toBe(getSupabaseClient());
  expect(createClient).toHaveBeenCalledExactlyOnceWith("https://auth.invalid", "public-test-key", {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
});
it("fails closed when public configuration is missing", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
  const { getSupabaseClient } = await import("./supabase");
  expect(getSupabaseClient).toThrow("Supabase bağlantı yapılandırması eksik.");
  expect(createClient).not.toHaveBeenCalled();
});
