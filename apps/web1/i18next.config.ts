import { defineConfig } from "i18next-cli";

export default defineConfig({
  locales: ["tr"],
  extract: {
    input: ["src/**/*.{ts,tsx}"],
    output: "src/locales/{{language}}/{{namespace}}.json",
    primaryLanguage: "tr",
    defaultNS: "common",
    removeUnusedKeys: false,
    extractFromComments: false,
  },
  types: {
    input: "src/locales/tr/**/*.json",
    output: "src/i18n/generated/i18next.d.ts",
    resourcesFile: "src/i18n/generated/resources.d.ts",
    enableSelector: true,
  },
});
