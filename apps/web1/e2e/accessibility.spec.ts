import { expect, test } from "@playwright/test";
import { scanAccessibility } from "./accessibility.js";

test("WCAG 2.2 AA catches adjacent undersized targets while keeping default landmark checks", async ({
  page,
}) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:4173"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/");
  // An isolated negative specimen, never a product component or accepted screen.
  await page.setContent(
    '<!doctype html><html lang="tr"><head><title>WCAG policy negative specimen</title></head><body><button aria-label="Birinci" style="width:10px;height:10px;padding:0;position:absolute;left:10px;top:10px"></button><button aria-label="İkinci" style="width:10px;height:10px;padding:0;position:absolute;left:22px;top:10px"></button></body></html>',
  );
  const result = await scanAccessibility(page);
  expect(result.violations.some((rule) => rule.id === "target-size")).toBe(true);
  expect(result.violations.some((rule) => rule.id === "landmark-one-main")).toBe(true);
});

test("the reflow measurement detects genuine horizontal overflow under CSS zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.setContent(
    '<html lang="tr" style="zoom:2"><head><title>Negative reflow specimen</title></head><body><main style="width:500px">Oversized content</main></body></html>',
  );
  expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(true);
});
