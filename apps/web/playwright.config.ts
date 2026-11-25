import { defineConfig } from "@playwright/test";
import { activeBrowserProfile } from "./scripts/playwright-device.js";

const baseURL = "http://127.0.0.1:4173";
const { project, device, engine } = activeBrowserProfile();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: Boolean(process.env.CI),
  forbidOnly: true,
  retries: 0,
  // Keep shard parallelism, but give WebKit the runner's resources for each test.
  workers: process.env.GITHUB_ACTIONS === "true" && engine === "chromium" ? 2 : 1,
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
    {
      name: project,
      testIgnore: "**/auth-*.spec.ts",
      use: device,
    },
    {
      name: `auth-${project}`,
      testMatch: "**/auth-*.spec.ts",
      use: { ...device, baseURL: "http://127.0.0.1:4175" },
    },
  ],
  webServer: [
    {
      command: "pnpm dev --host 127.0.0.1 --port 4175 --strictPort --mode e2e",
      url: "http://127.0.0.1:4175",
      reuseExistingServer: false,
      env: {
        FTK_VITE_CACHE_DIR: "node_modules/.vite-e2e-auth",
        VITE_SUPABASE_URL: "http://127.0.0.1:4175",
        VITE_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
        VITE_APP_ORIGIN: "http://127.0.0.1:4175",
        VITE_PUBLIC_GATEWAY_URL: "http://127.0.0.1:4175",
        VITE_TURNSTILE_SITE_KEY: "e2e-provider-stub-key",
      },
    },
    {
      command: "pnpm dev --host 127.0.0.1 --port 4173 --strictPort --mode e2e",
      url: baseURL,
      reuseExistingServer: false,
      env: {
        FTK_VITE_CACHE_DIR: "node_modules/.vite-e2e-public",
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_PUBLISHABLE_KEY: "",
      },
    },
    {
      command: "pnpm dev --host 127.0.0.1 --port 4174 --strictPort --mode development",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: false,
      env: {
        FTK_VITE_CACHE_DIR: "node_modules/.vite-e2e-devtools",
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_PUBLISHABLE_KEY: "",
      },
    },
  ],
});
