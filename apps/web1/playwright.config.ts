import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  outputDir: "./test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-reports/playwright.json" }],
    ["junit", { outputFile: "test-reports/playwright.xml" }],
  ],
  use: {
    baseURL,
    locale: "tr-TR",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", testIgnore: "**/auth-flow.spec.ts", use: { ...devices["Desktop Chrome"] } },
    {
      name: "auth-chromium",
      testMatch: "**/auth-flow.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4175" },
    },
  ],
  webServer: [
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4175 --strictPort --mode e2e",
      url: "http://127.0.0.1:4175",
      reuseExistingServer: false,
      env: {
        VITE_SUPABASE_URL: "http://127.0.0.1:4175",
        VITE_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
        VITE_APP_ORIGIN: "http://127.0.0.1:4175",
        VITE_PUBLIC_GATEWAY_URL: "http://127.0.0.1:4175",
        VITE_TURNSTILE_SITE_KEY: "",
      },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort --mode e2e",
      url: baseURL,
      reuseExistingServer: false,
      env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4174 --strictPort --mode development",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: false,
      env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
    },
  ],
});
