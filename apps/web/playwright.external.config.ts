import { defineConfig } from "@playwright/test";
import { activeBrowserProfile } from "./playwright-device.js";

const baseURL = "http://127.0.0.1:4175";

const { device } = activeBrowserProfile();

export default defineConfig({
  testDir: "./e2e-external",
  forbidOnly: true,
  retries: 0,
  timeout: 45_000,
  workers: process.env.CI ? 2 : 1,
  outputDir: "./test-results/external",
  reporter: [["list"], ["json", { outputFile: "test-reports/external-playwright.json" }]],
  use: { ...device, baseURL, locale: "tr-TR", serviceWorkers: "block" },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 4175 --strictPort --mode e2e",
    url: baseURL,
    reuseExistingServer: false,
    env: {
      VITE_APP_ORIGIN: baseURL,
      VITE_PUBLIC_GATEWAY_URL: baseURL,
      VITE_SUPABASE_URL: baseURL,
      VITE_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
      VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    },
  },
});
