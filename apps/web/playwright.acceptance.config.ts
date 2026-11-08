import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (!baseURL || !/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(baseURL))
  throw Error("Batch acceptance requires a verified immutable Vercel deployment URL.");

export default defineConfig({
  testDir: "./tests/acceptance",
  outputDir: "../../.artifacts/frontend/live-batch/private-results",
  preserveOutput: "never",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["./tests/acceptance/reporter.ts"]],
  use: {
    baseURL,
    browserName: "chromium",
    locale: "tr-TR",
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    { name: "pro-manager", testMatch: /(?:account|management|pro|crm)\.spec\.ts/ },
    { name: "starter-manager", testMatch: /(?:account|management|crm)\.spec\.ts/ },
    { name: "pro-instructor", testMatch: /(?:account|self)\.spec\.ts/ },
    { name: "pro-student", testMatch: /(?:account|self)\.spec\.ts/ },
  ],
});
