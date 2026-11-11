import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  // This foundation needs only the local Vite server; fail any external HTTP request.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:4173") {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
      throw new Error(`Unexpected external request: ${url.origin}`);
    }
  });
});

test("opens the Turkish application with fresh state", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await expect(page.getByRole("heading", { name: "FtkSaaS V2", exact: true })).toBeVisible();
  await expect(
    page.getByText("Vite + React + TanStack Router + React Aria", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Test Et", exact: true })).toBeEnabled();
  await expect(page.getByRole("status")).toHaveText("Tıklama sayısı: 0");
});

test("supports React Aria pointer and keyboard presses", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Test Et", exact: true });
  const status = page.getByRole("status");
  await expect(status).toHaveText("Tıklama sayısı: 0");
  await button.click();
  await expect(status).toHaveText("Tıklama sayısı: 1");
  await button.focus();
  await expect(button).toBeFocused();
  await button.press("Enter");
  await expect(status).toHaveText("Tıklama sayısı: 2");
  await button.press("Space");
  await expect(status).toHaveText("Tıklama sayısı: 3");
  await page.reload();
  await expect(status).toHaveText("Tıklama sayısı: 0");
});
