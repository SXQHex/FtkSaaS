import { expect, test, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { FailureEnvelope } from "../src/lib/api-contracts/generated.js";
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
const token = (aal: "aal1" | "aal2" = "aal1") =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(
      JSON.stringify({
        sub: id,
        aud: "authenticated",
        role: "authenticated",
        aal,
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

async function mockNative(page: Page, mfa = false) {
  const calls = {
    exchange: 0,
    password: 0,
    recover: 0,
    resend: 0,
    enroll: 0,
    remove: 0,
    rejectNextAccount: false,
    challenge: 0,
    verify: 0,
    account: 0,
  };
  let elevated = false;
  const user = {
    ...fixtureUser,
    factors: mfa
      ? [
          {
            id,
            status: "verified",
            factor_type: "totp",
            friendly_name: "Fixture TOTP",
            created_at: fixtureUser.created_at,
            updated_at: fixtureUser.created_at,
          },
        ]
      : [],
  };
  const session = () => ({
    access_token: token(elevated ? "aal2" : "aal1"),
    refresh_token: "fixture-refresh",
    token_type: "bearer",
    expires_in: 3600,
    user,
  });
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
        json: session(),
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
      return route.fulfill({ json: user });
    }
    if (url.pathname === "/auth/v1/factors" && route.request().method() === "POST") {
      calls.enroll++;
      user.factors = [
        {
          id,
          status: "unverified",
          factor_type: "totp",
          friendly_name: "Fixture TOTP",
          created_at: fixtureUser.created_at,
          updated_at: fixtureUser.created_at,
        },
      ];
      return route.fulfill({
        json: {
          id,
          type: "totp",
          friendly_name: "Fixture TOTP",
          totp: {
            secret: "SYNTHETIC-TEST-KEY",
            qr_code:
              '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><path fill="black" d="M8 8h40v40H8zM96 8h40v40H96zM8 96h40v40H8zM72 72h16v16H72z"/></svg>',
            uri: "otpauth://totp/fixture?secret=SYNTHETIC",
          },
        },
      });
    }
    if (url.pathname === `/auth/v1/factors/${id}` && route.request().method() === "DELETE") {
      calls.remove++;
      user.factors = [];
      elevated = false;
      return route.fulfill({ json: { id } });
    }
    if (url.pathname === "/functions/v1/backend-v1/account_security_history_get_v1")
      return route.fulfill({
        json: {
          ok: true,
          data: {
            items: elevated
              ? [
                  {
                    id,
                    at: fixtureUser.created_at,
                    action: "totp_enabled",
                    session_id: id,
                    affected_count: 1,
                  },
                ]
              : [],
            next_cursor: null,
            as_of: fixtureUser.created_at,
          },
          trace_id: id,
        },
      });
    if (url.pathname === `/auth/v1/factors/${id}/challenge`) {
      calls.challenge++;
      return route.fulfill({
        json: { id, type: "totp", expires_at: Math.floor(Date.now() / 1000) + 60 },
      });
    }
    if (url.pathname === `/auth/v1/factors/${id}/verify`) {
      calls.verify++;
      if (route.request().postDataJSON().code !== "123456")
        return route.fulfill({
          status: 422,
          json: { code: "mfa_verification_failed", msg: "Invalid verification code" },
        });
      elevated = true;
      user.factors = user.factors.map((factor) => ({ ...factor, status: "verified" }));
      return route.fulfill({ json: session() });
    }
    if (url.pathname === "/functions/v1/backend-v1/account_get_v1") {
      calls.account++;
      if (calls.rejectNextAccount) {
        calls.rejectNextAccount = false;
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            error: { code: "TEMPORARY_FAILURE", retryable: true, trace_id: id },
          } satisfies FailureEnvelope,
        });
      }
      if (mfa && !elevated)
        return route.fulfill({
          status: 403,
          json: {
            ok: false,
            error: { code: "AUTH_REQUIRED", retryable: false, trace_id: id },
          } satisfies FailureEnvelope,
        });
      return route.fulfill({
        json: {
          ok: true,
          data: { id, state: "active", display_name: "Fixture Account" },
          trace_id: id,
        },
      });
    }
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

test("native TOTP keeps the protected target closed until verification and AAL2 reread", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page, true);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/mfa");
  await expect(page).toHaveURL(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/mfa`);
  await page.reload();
  await captureAuth(page, "e06", testInfo);
  expect(calls.account).toBe(0);
  const code = page.getByLabel("Doğrulama kodu");
  await code.fill("000000");
  await code.press("Enter");
  await expect(page.getByText("Kod doğrulanamadı. Güncel kodla yeniden dene.")).toBeVisible();
  await expect(page).toHaveURL(`${origin}/mfa`);
  expect(calls.account).toBe(0);
  await code.fill("123456");
  await code.press("Enter");
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  expect(calls.challenge).toBe(2);
  expect(calls.verify).toBe(2);
  expect(calls.account).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("native TOTP enrollment cancels safely then verifies and rereads without repeating the code", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.getByRole("tab", { name: "Güvenlik" }).click();
  await expect(page.getByRole("button", { name: "Kur", exact: true })).toBeVisible();
  await captureAuth(page, "e10-security", testInfo);
  await page.getByRole("button", { name: "Kur", exact: true }).click();
  await expect(page.getByLabel("Uygulamadaki 6 haneli kod")).toBeVisible();
  await captureAuth(page, "e10-totp-dialog", testInfo);
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(calls.enroll).toBe(1);
  expect(calls.remove).toBe(0);
  await page.getByRole("button", { name: "Kaldır", exact: true }).click();
  expect(calls.remove).toBe(0);
  await page.getByRole("button", { name: "Uygulamayı kaldır", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(calls.remove).toBe(1);
  await page.getByRole("button", { name: "Kur", exact: true }).click();
  await page.getByLabel("Uygulamadaki 6 haneli kod").fill("123456");
  calls.rejectNextAccount = true;
  await page.getByRole("button", { name: "Kodu doğrula", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("İşlem sonrasında güvenlik bilgileri yenilenemedi.")).toBeVisible();
  await expect(page.getByText("Doğrulama uygulaması etkinleştirildi")).toBeVisible();
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Güvenlik bilgileri yenilendi.");
  expect(calls.verify).toBe(1);
  expect(calls.enroll).toBe(2);
  await expect(page.getByText("SYNTHETIC-TEST-KEY")).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "Güvenlik" }).click();
  await expect(page.getByText("Doğrulanmış uygulama")).toBeVisible();
  expect(errors).toEqual([]);
});
