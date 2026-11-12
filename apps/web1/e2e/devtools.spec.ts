import { expect, test } from "@playwright/test";

test("shares Query, Router and live Form state in one development panel", async ({
  page,
  context,
}) => {
  const origin = "http://127.0.0.1:4174";
  await context.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin === origin) {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
      throw new Error("Unexpected external request in Devtools test");
    }
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/?__form_example`);
  await expect(
    page.getByRole("heading", { name: "Form altyapısı örneği", exact: true }),
  ).toBeVisible();
  const trigger = page.getByRole("button", { name: "Open TanStack Devtools", exact: true });
  await expect(trigger).toHaveCount(1);
  await trigger.click();
  await expect(page.getByRole("banner", { name: "TanStack Devtools", exact: true })).toHaveCount(1);
  for (const name of ["TanStack Query", "TanStack Router", "TanStack Form"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "TanStack Query", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clear query cache", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "TanStack Router", exact: true }).click();
  await expect(page.getByRole("button", { name: "Routes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "TanStack Form", exact: true }).click();

  const input = page.getByRole("textbox", { name: "Örnek metin", exact: true });
  await input.fill("ab");
  await page.getByRole("button", { name: "Örneği gönder", exact: true }).click();
  await expect(page.getByText("schema-example", { exact: true })).toBeVisible();
  await page.getByText("schema-example", { exact: true }).click();
  const panel = page.getByTestId("tanstack-devtools-panel");
  await expect(panel.getByText("Form values", { exact: true })).toBeVisible();
  await expect(panel.getByText("Individual Fields", { exact: true })).toBeVisible();
  await expect(panel).toContainText('"text": "ab"');
  await expect(panel).toContainText('"isTouched": true');
  await expect(panel).toContainText('"isValid": false');
  // Expand the actual Zod issue in the Form panel, rather than reading the input's error message.
  const fieldErrors = panel.getByText(/"errors":\s*1 items/);
  await fieldErrors.click();
  await fieldErrors.locator("..").getByText("...", { exact: true }).click();
  await expect(panel).toContainText("En az 3 karakter girin.");

  await input.fill("örnek");
  await expect(panel).toContainText('"text": "örnek"');
  await expect(panel).toContainText('"isValid": true');
  await expect(panel).not.toContainText("En az 3 karakter girin.");
  await page.getByRole("button", { name: "Örneği gönder", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Örnek gönderildi.");
  expect(errors).toEqual([]);
});
