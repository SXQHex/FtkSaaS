import { activate, hasTouchInput } from "./device-input.js";
import { test as base, expect } from "./test.js";
import { loadEnv, preview, type PreviewServer } from "vite";
import { mockSessionDetail } from "./session-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
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
    const entryResponse = await page.goto(`${artifact.origin}/`);
    expect(entryResponse?.status()).toBe(200);
    await expect(page).toHaveURL(`${artifact.origin}/login`);
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
        entryRedirect: true,
        protectedRedirect: true,
        pageErrors: pageErrors.length,
      }),
      contentType: "application/json",
    });
  });

test("production artifact reads the center calendar in its own timezone after a direct URL and reload", async ({
  page,
  artifact,
}, testInfo) => {
  const configuration = loadEnv("production", root, "VITE_");
  const authOrigin = new URL(configuration.VITE_SUPABASE_URL!).origin;
  await page.setViewportSize({ width: 320, height: 950 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  const [workspaceRead, state] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url() === `${authOrigin}/functions/v1/backend-v1/roles_list_v1` &&
        response.request().method() === "POST" &&
        response.ok(),
    ),
    mockSessionDetail(page, {
      existing: true,
      openDetail: false,
      allowEditor: true,
      origins: { app: artifact.origin, auth: authOrigin },
    }),
  ]);
  expect(await workspaceRead.finished()).toBeNull();
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  state.session.starts_at = "2026-11-16T13:00:00Z";
  state.session.ends_at = "2026-11-16T14:00:00Z";
  await page.route("**/functions/v1/backend-v1/management_work_list_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: { items: [], next_cursor: null, as_of: "2026-11-16T12:00:00Z" },
        trace_id: I.role,
      },
    }),
  );
  const path = `${artifact.origin}/o/${I.org}/c/${I.center}/overview`;
  const result = await page.goto(path);
  expect(result?.status()).toBe(200);
  const next = page.getByRole("region", { name: "Sıradaki ders", exact: true });
  await expect(next).toContainText("Sentetik seans");
  await expect(next).toContainText("16:00");
  expect(state.calendarReads).toContainEqual(
    expect.objectContaining({
      org_id: I.org,
      center_id: I.center,
      interval: { starts_at: "2026-11-15T21:00:00Z", ends_at: "2026-11-16T21:00:00Z" },
    }),
  );
  await page.reload();
  await expect(page).toHaveURL(path);
  await expect(next).toContainText("16:00");
  if (hasTouchInput(page)) {
    await activate(
      page
        .getByRole("link", { name: "İçeriğe geç", exact: true })
        .or(page.getByRole("button", { name: "Menüyü aç veya kapat", exact: true }))
        .filter({ visible: true })
        .first(),
    );
  } else {
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus-visible")).toBeVisible();
  }
  expect(errors).toEqual([]);
  await testInfo.attach("production-calendar", {
    body: JSON.stringify({
      ...artifact,
      timezone: "Europe/Istanbul",
      start: "16:00",
      reload: true,
    }),
    contentType: "application/json",
  });
});
