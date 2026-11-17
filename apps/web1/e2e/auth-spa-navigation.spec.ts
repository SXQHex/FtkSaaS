import { test, expect } from "./test.js";
import { mockStudio, openStudio } from "./studio-fixture.js";
import { mockNative, origin } from "./auth-fixture.js";

test("sidebar navigation preserves the document and cached studio reads", async ({
  page,
}, info) => {
  const reads: Record<string, number> = {};
  let documents = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++;
    if (request.url().includes("/functions/v1/backend-v1/")) {
      const operation = new URL(request.url()).pathname.split("/").at(-1)!;
      reads[operation] = (reads[operation] ?? 0) + 1;
    }
  });
  await mockStudio(page);
  await openStudio(page);
  const lifetime = await page.evaluate("window.__spaLifetime = performance.timeOrigin");
  const before = { ...reads };
  expect(before.organizations_list_v1).toBe(1);
  expect(before.roles_list_v1).toBe(1);
  const initialDocuments = documents;
  const menu = page.getByRole("navigation", { name: "Ana menü", exact: true });
  await menu.getByRole("link", { name: "Üyeler", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Üyeler", exact: true })).toBeVisible();
  await menu.getByRole("link", { name: "Stüdyo", exact: true }).click();
  await expect(page.getByRole("button", { name: /Örnek Eğitmen/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Üyeler", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Stüdyo", exact: true })).toBeVisible();
  await info.attach("navigation-read-counts", {
    body: JSON.stringify({ before, after: reads, documents: documents - initialDocuments }),
    contentType: "application/json",
  });
  expect(await page.evaluate("window.__spaLifetime")).toBe(lifetime);
  expect(await page.evaluate("performance.timeOrigin")).toBe(lifetime);
  expect(documents).toBe(initialDocuments);
  expect(reads.management_state_get_v1).toBe(before.management_state_get_v1);
});

test("auth links use SPA history while modified clicks retain native new-tab navigation", async ({
  page,
  context,
}) => {
  await mockNative(page);
  await page.goto(`${origin}/login`);
  const lifetime = await page.evaluate("window.__spaLifetime = performance.timeOrigin");
  const forgot = page.getByRole("link", { name: "Parolamı unuttum", exact: true });
  const popupPromise = context.waitForEvent("page");
  await forgot.click({ modifiers: ["ControlOrMeta"] });
  const popup = await popupPromise;
  await popup.waitForURL(`${origin}/forgot-password`);
  await popup.close();
  await forgot.click();
  await expect(
    page.getByRole("heading", { name: "Parolanı mı unuttun?", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Hesabına giriş yap", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate("window.__spaLifetime")).toBe(lifetime);
  expect(await page.evaluate("performance.timeOrigin")).toBe(lifetime);
});
