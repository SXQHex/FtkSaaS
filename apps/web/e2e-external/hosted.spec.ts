import { activate, hasTouchInput } from "../e2e/device-input.js";
import { test, expect } from "../e2e/test.js";

const origin = "https://app.fethiyetango.com";
const authOrigin = "https://gwyprhenabtpkbojephw.supabase.co";

test("G-PRO-04 hosted SPA keeps direct routes and accessible keyboard controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.name));
  expect((await page.goto(`${origin}/login`))?.status()).toBe(200);
  const signIn = page.getByRole("heading", { name: "Hesabına giriş yap", exact: true });
  await expect(signIn).toBeVisible();
  if (hasTouchInput(page)) {
    const password = page.getByLabel("Parola", { exact: true });
    await activate(password);
    await expect(password).toBeFocused();
  } else {
    await page.getByLabel("E-posta", { exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Parolamı unuttum" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Parola", { exact: true })).toBeFocused();
  }

  const documentStart = await page.evaluate("performance.timeOrigin");
  const signup = page.getByRole("link", { name: "Kayıt ol", exact: true });
  if (!hasTouchInput(page)) await signup.focus();
  await activate(signup, "Enter");
  await expect(page).toHaveURL(`${origin}/signup`);
  await expect(page.getByRole("heading", { name: "Hesabını oluştur", exact: true })).toBeVisible();
  expect(await page.evaluate("performance.timeOrigin")).toBe(documentStart);
  expect((await page.reload())?.status()).toBe(200);
  await expect(page.getByLabel("Parola tekrar", { exact: true })).toBeVisible();
  expect((await page.goto(`${origin}/account`))?.status()).toBe(200);
  await expect(signIn).toBeVisible();
  expect(new URL(page.url()).origin + new URL(page.url()).pathname).toBe(`${origin}/login`);
  expect(pageErrors).toEqual([]);
});

test("P01.3 hosted Google start uses the public Web1 callback without a real account", async ({
  page,
  request,
}) => {
  await page.goto(`${origin}/login`);
  const authorize = page.waitForRequest(
    (req) => new URL(req.url()).pathname === "/auth/v1/authorize",
  );
  // Read the upstream redirect explicitly and stop before Google's interactive page.
  await page.route("**/auth/v1/authorize?*", (route) => route.abort());
  await activate(page.getByRole("button", { name: "Google ile devam et", exact: true }));
  const url = new URL((await authorize).url());
  expect(url.origin).toBe(authOrigin);
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toBe(`${origin}/auth/callback`);
  const response = await request.get(url.href, { maxRedirects: 0, timeout: 10_000 });
  expect(response.status()).toBe(302);
  const provider = new URL(response.headers().location!);
  expect(provider.origin).toBe("https://accounts.google.com");
  expect(provider.searchParams.get("redirect_uri")).toBe(`${url.origin}/auth/v1/callback`);
  await page.goto(`${origin}/login`);
});
