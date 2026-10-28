import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
const credentialsFile = new URL("./.env.e2e.local", import.meta.url);
if (existsSync(credentialsFile)) process.loadEnvFile(fileURLToPath(credentialsFile));
if (!process.env.FTK_E2E_EMAIL || !process.env.FTK_E2E_PASSWORD)
  throw new Error(
    "Canlı kabul için FTK_E2E_EMAIL ve FTK_E2E_PASSWORD ortam değişkenlerinde veya Git dışındaki apps/web/.env.e2e.local dosyasında mevcut yetkili test hesabını belirt.",
  );
export default defineConfig({
  ...base,
  testDir: "./tests/live",
  outputDir: "../../.artifacts/frontend/live",
  preserveOutput: "never",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: { ...base.use, trace: "off", screenshot: "off", video: "off" },
  projects: [{ name: "live-chromium", use: { browserName: "chromium" } }],
});
