import { test, expect } from "./test.js";
import { mockStudio, openStudio } from "./studio-fixture.js";
import { clickWorkspaceLink, mockNative, origin } from "./auth-fixture.js";

test("sidebar navigation preserves the document and cached studio reads", async ({
  page,
}, info) => {
  const reads: Record<string, number> = {};
  const managementReads: Record<string, number> = {};
  const phases: { name: string; durationMs: number; accountReads: number }[] = [];
  let phaseStarted = performance.now();
  let previousAccounts = 0;
  const recordPhase = (name: string) => {
    const accounts = reads.account_get_v1 ?? 0;
    phases.push({
      name,
      durationMs: performance.now() - phaseStarted,
      accountReads: accounts - previousAccounts,
    });
    previousAccounts = accounts;
    phaseStarted = performance.now();
  };
  let documents = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++;
    if (request.url().includes("/functions/v1/backend-v1/")) {
      const operation = new URL(request.url()).pathname.split("/").at(-1)!;
      reads[operation] = (reads[operation] ?? 0) + 1;
      if (operation === "management_state_get_v1" && request.method() === "POST") {
        const { operation: selector } = request.postDataJSON() as { operation: string };
        managementReads[selector] = (managementReads[selector] ?? 0) + 1;
      }
    }
  });
  await mockStudio(page);
  await openStudio(page);
  recordPhase("login-and-studio");
  const lifetime = await page.evaluate("window.__spaLifetime = performance.timeOrigin");
  const before = { ...reads };
  const beforeManagement = { ...managementReads };
  expect(before.organizations_list_v1).toBe(1);
  expect(before.roles_list_v1).toBe(1);
  const initialDocuments = documents;
  await clickWorkspaceLink(page, "Üyeler");
  await expect(page.getByRole("heading", { name: "Üyeler", exact: true })).toBeVisible();
  recordPhase("members");
  expect(reads.centers_list_v1 ?? 0).toBe(before.centers_list_v1 ?? 0);
  await clickWorkspaceLink(page, "Stüdyo");
  await expect(page.getByRole("button", { name: /Örnek Eğitmen/ })).toBeVisible();
  recordPhase("studio");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Üyeler", exact: true })).toBeVisible();
  recordPhase("back-to-members");
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Stüdyo", exact: true })).toBeVisible();
  recordPhase("forward-to-studio");
  await info.attach("navigation-read-counts", {
    body: JSON.stringify({
      before,
      after: reads,
      beforeManagement,
      afterManagement: managementReads,
      phases,
      documents: documents - initialDocuments,
    }),
    contentType: "application/json",
  });
  expect(await page.evaluate("window.__spaLifetime")).toBe(lifetime);
  expect(await page.evaluate("performance.timeOrigin")).toBe(lifetime);
  expect(documents).toBe(initialDocuments);
  const { person_merge_preview_v1: mergeReads, ...cachedReads } = managementReads;
  expect(mergeReads).toBe(1);
  expect(cachedReads).toEqual(beforeManagement);
  expect(reads.subscription_get_v1).toBe(1);
  expect(reads.account_get_v1).toBe(before.account_get_v1);
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
