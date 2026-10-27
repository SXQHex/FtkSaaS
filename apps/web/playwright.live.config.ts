import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
if (!process.env.FTK_E2E_EMAIL || !process.env.FTK_E2E_PASSWORD)
  throw new Error(
    "Canlı kabul için FTK_E2E_EMAIL ve FTK_E2E_PASSWORD ortam değişkenlerinde mevcut yetkili test hesabını belirt.",
  );
export default defineConfig(base, {
  testDir: "./tests/live",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: { trace: "off", screenshot: "off", video: "off" },
  projects: [{ name: "live-chromium", use: { browserName: "chromium" } }],
});
