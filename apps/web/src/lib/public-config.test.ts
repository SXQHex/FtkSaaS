import { afterEach, expect, it, vi } from "vitest";
import {
  hasSupabaseConfig,
  readPublicGatewayUrl,
  readTurnstileSiteKey,
  requireAppOrigin,
  requireSupabasePublishableKey,
  requireSupabaseUrl,
} from "./public-config";

afterEach(() => vi.unstubAllEnvs());

it("normalizes Vite URLs and keys while preserving the local callback origin", () => {
  vi.stubEnv("VITE_SUPABASE_URL", " https://auth.invalid/ ");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", " fixture-key ");
  vi.stubEnv("VITE_PUBLIC_GATEWAY_URL", " https://gateway.invalid/ ");
  vi.stubEnv("VITE_APP_ORIGIN", "http://127.0.0.1:5173/");
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", " site-key ");
  expect(hasSupabaseConfig()).toBe(true);
  expect(requireSupabaseUrl()).toBe("https://auth.invalid");
  expect(requireSupabasePublishableKey()).toBe("fixture-key");
  expect(readPublicGatewayUrl()).toBe("https://gateway.invalid");
  expect(requireAppOrigin()).toBe("http://127.0.0.1:5173");
  expect(readTurnstileSiteKey()).toBe("site-key");
});

it("rejects invalid URLs and missing or empty configuration", () => {
  vi.stubEnv("VITE_SUPABASE_URL", "file:///tmp/auth");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "  ");
  vi.stubEnv("VITE_PUBLIC_GATEWAY_URL", "https://user:pass@gateway.invalid");
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.invalid/wrong-base");
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", undefined);
  expect(hasSupabaseConfig()).toBe(false);
  expect(() => requireSupabaseUrl()).toThrow("Supabase bağlantı yapılandırması eksik.");
  expect(() => requireSupabasePublishableKey()).toThrow("Supabase bağlantı yapılandırması eksik.");
  expect(readPublicGatewayUrl()).toBeUndefined();
  expect(() => requireAppOrigin()).toThrow("APP_ORIGIN_REQUIRED");
  expect(readTurnstileSiteKey()).toBeUndefined();
});
