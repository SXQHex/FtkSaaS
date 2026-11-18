import { test as base, expect } from "./test.js";
import { preview, type PreviewServer } from "vite";
import { fileURLToPath } from "node:url";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const test = base.extend<
  {},
  {
    artifact: {
      origin: string;
      browser: string;
      htmlHash: string;
      builtAt: string;
      source: string;
    };
  }
>({
  artifact: [
    async ({ browserName }, provide) => {
      const path = new URL("../dist/index.html", import.meta.url);
      const [html, file] = await Promise.all([readFile(path), stat(path)]);
      const source = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();
      let server: PreviewServer | undefined;
      try {
        server = await preview({
          configFile: false,
          root,
          logLevel: "silent",
          preview: { host: "127.0.0.1", port: 0, strictPort: true },
        });
        const address = server.httpServer.address();
        if (!address || typeof address === "string") throw Error("STATIC_PREVIEW_UNAVAILABLE");
        await provide({
          origin: `http://127.0.0.1:${address.port}`,
          browser: browserName,
          htmlHash: createHash("sha256").update(html).digest("hex"),
          builtAt: file.mtime.toISOString(),
          source,
        });
      } finally {
        if (server)
          await new Promise<void>((resolve, reject) =>
            server!.httpServer.close((error) => (error ? reject(error) : resolve())),
          );
      }
    },
    { scope: "worker" },
  ],
});

for (const colorScheme of ["light", "dark"] as const)
  test(`production artifact serves direct URLs and protected reload without devtools or hydration errors ${colorScheme}`, async ({
    page,
    artifact,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.name));
    const response = await page.goto(`${artifact.origin}/login`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Hesabına giriş yap", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Hesabına giriş yap", exact: true }),
    ).toBeVisible();
    const protectedResponse = await page.goto(`${artifact.origin}/account`);
    expect(protectedResponse?.status()).toBe(200);
    await expect.poll(() => new URL(page.url()).pathname).toBe("/login");
    await expect(
      page.getByRole("heading", { name: "Hesabına giriş yap", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Hesabına giriş yap", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/TanStack Devtools/i)).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    const scripts = await page
      .locator('script[type="module"][src]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("src")));
    expect(scripts.some((src) => src?.startsWith("/assets/"))).toBe(true);
    expect(scripts.some((src) => src?.includes("/@vite/") || src?.includes("/src/"))).toBe(false);
    await testInfo.attach("production-artifact", {
      body: JSON.stringify({
        ...artifact,
        colorScheme,
        directUrl: true,
        reload: true,
        protectedRedirect: true,
        pageErrors: pageErrors.length,
      }),
      contentType: "application/json",
    });
  });
