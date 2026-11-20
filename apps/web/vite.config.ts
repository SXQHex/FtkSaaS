import { mkdirSync, writeFileSync } from "node:fs";
import { devtools } from "@tanstack/devtools-vite";
import { coverageConfigDefaults, defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command, mode }) => ({
  plugins: [
    ...(command === "serve" && mode === "development" ? [devtools()] : []),
    {
      name: "e2e-oauth-redirect",
      apply: (_config, env) => env.command === "serve" && env.mode === "e2e",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.method !== "GET" || request.url?.split("?")[0] !== "/auth/v1/authorize") {
            return next();
          }
          response.writeHead(302, { Location: "/auth/callback?code=fixture-google-code" });
          response.end();
        });
      },
    },
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    {
      name: "record-production-modules",
      apply: "build",
      generateBundle(_options, bundle) {
        const modules = Object.values(bundle).flatMap((chunk) =>
          chunk.type === "chunk" ? Object.keys(chunk.modules) : [],
        );
        const directory = fileURLToPath(new URL("./.tmp/", import.meta.url));
        mkdirSync(directory, { recursive: true });
        writeFileSync(
          new URL("./.tmp/production-modules.json", import.meta.url),
          JSON.stringify(modules),
        );
      },
    },
  ],
  test: {
    ...(!process.env.CI ? { maxWorkers: 1, fileParallelism: false } : {}),
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/routeTree.gen.ts",
        "src/i18n/generated/**",
        "src/test/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
}));
