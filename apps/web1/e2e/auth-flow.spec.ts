import { expect, test, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = "http://127.0.0.1:4175";
const id = "019a7b00-0000-7000-8000-000000000001";
const fixtureUser = {
  id,
  email: "fixture@example.invalid",
  aud: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-11-13T00:00:00Z",
  email_confirmed_at: "2026-11-13T00:00:00Z",
};
const token = () =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(
      JSON.stringify({
        sub: id,
        aud: "authenticated",
        role: "authenticated",
        aal: "aal1",
        amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }],
        exp: Math.floor(Date.now() / 1000) + 3600,
        session_id: id,
      }),
    ).toString("base64url"),
    Buffer.from("fixture-signature").toString("base64url"),
  ].join(".");

async function captureAuth(page: Page, name: string, testInfo: TestInfo) {
  await expect(page.locator("main h1")).toBeVisible();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme });
      // Scan the stable requested theme, after the registry controls finish their CSS transitions.
      await page.evaluate(
        "Promise.all(document.getAnimations().map(animation => animation.finished))",
      );
      expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      const body = await page.screenshot({
        path: `.tmp/${name}-app-${viewport.width}-${colorScheme}.png`,
      });
      await testInfo.attach(`${name}-${viewport.width}-${colorScheme}`, {
        body,
        contentType: "image/png",
      });
    }
  }
}

async function mockNative(page: Page) {
  const calls = { exchange: 0, password: 0, recover: 0, resend: 0 };
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    expect(url.origin).toBe(origin);
    if (url.pathname === "/auth/v1/authorize")
      return route.fulfill({
        status: 302,
        headers: { location: `${origin}/auth/callback?code=fixture-google-code` },
      });
    if (url.pathname === "/auth/v1/token") {
      calls.exchange++;
      return route.fulfill({
        json: {
          access_token: token(),
          refresh_token: "fixture-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user: fixtureUser,
        },
      });
    }
    if (url.pathname === "/auth/v1/recover") {
      calls.recover++;
      return route.fulfill({ json: {} });
    }
    if (url.pathname === "/auth/v1/resend") {
      calls.resend++;
      return route.fulfill({ json: {} });
    }
    if (url.pathname === "/auth/v1/user") {
      if (route.request().method() === "PUT") calls.password++;
      return route.fulfill({ json: fixtureUser });
    }
    if (url.pathname === "/functions/v1/backend-v1/account_get_v1")
      return route.fulfill({
        json: {
          ok: true,
          data: { id, state: "active", display_name: "Fixture Account" },
          trace_id: id,
        },
      });
    await route.continue();
  });
  return calls;
}

test("native recovery callback survives URL cleaning, reload and password save", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/forgot-password");
  await captureAuth(page, "e04", testInfo);
  await page.getByLabel("E-posta").fill("fixture@example.invalid");
  await page.getByRole("button", { name: "Bağlantı gönder" }).click();
  await expect(page.getByRole("heading", { name: "E-postanı kontrol et" })).toBeVisible();
  expect(calls.recover).toBe(1);
  await page.goto("/auth/callback?code=fixture-recovery-code&next=/reset-password");
  await expect(page).toHaveURL(`${origin}/reset-password`);
  await page.reload();
  await expect(page.getByLabel("Yeni parola")).toBeVisible();
  const otherTab = await page.context().newPage();
  await otherTab.bringToFront();
  await page.bringToFront();
  await otherTab.close();
  await captureAuth(page, "e05", testInfo);
  await page.getByLabel("Yeni parola").fill("fixture-new-password");
  await page.getByLabel("Parola tekrar").fill("different-password");
  await page.getByRole("button", { name: "Parolayı kaydet" }).click();
  await expect(page.getByText("Parolalar eşleşmiyor.")).toBeVisible();
  expect(calls.password).toBe(0);
  await page.getByLabel("Parola tekrar").fill("fixture-new-password");
  await page.getByRole("button", { name: "Parolayı kaydet" }).click();
  await expect(page.getByRole("status")).toHaveText("Parolan kaydedildi.");
  expect(calls.exchange).toBe(1);
  expect(calls.password).toBe(1);
  expect(errors).toEqual([]);
  await page.goto("/reset-password");
  await expect(page).toHaveURL(`${origin}/forgot-password`);
});

test("native OAuth callback exchanges once and enters the protected account", async ({ page }) => {
  const calls = await mockNative(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Google ile devam et" }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  expect(calls.exchange).toBe(1);
});

test("resending confirmation is explicit and does not claim email verification", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  await page.goto("/verify-email");
  await captureAuth(page, "e03", testInfo);
  expect(calls.resend).toBe(0);
  await page.getByRole("button", { name: "Yeniden gönder" }).click();
  expect(calls.resend).toBe(0);
  await page.getByLabel("E-posta").fill("fixture@example.invalid");
  await page.getByRole("button", { name: "Yeniden gönder" }).click();
  await expect(page.getByRole("status")).toContainText("Uygun bir kayıt varsa");
  await expect(page.getByRole("heading", { name: "E-postan doğrulandı" })).toHaveCount(0);
  expect(calls.resend).toBe(1);
});
