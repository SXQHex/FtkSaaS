import { test, expect } from "./test.js";
import { readLayoutFit, assertLayoutFit } from "./layout.js";
test("shared layout guard rejects real page overflow and an offscreen dialog", async ({ page }) => {
  await page.setContent(
    '<html lang="tr"><head><title>Yerleşim koruması</title></head><body><main><h1>Yerleşim koruması</h1><div id="wide" style="width:2000px;height:1px"></div></main></body></html>',
  );
  const overflowing = await readLayoutFit(page);
  expect(() => assertLayoutFit(overflowing)).toThrow();
  expect(overflowing.documentWidth).toBeGreaterThan(1440);
  await page.locator("#wide").evaluate((element) => element.remove());
  await page
    .locator("main")
    .evaluate((element) =>
      element.insertAdjacentHTML(
        "beforeend",
        '<div role="dialog" aria-label="Örnek panel" style="position:fixed;left:-100px;top:0;width:300px;height:100px">Panel</div>',
      ),
    );
  const offscreen = await readLayoutFit(page);
  expect(() => assertLayoutFit(offscreen)).toThrow();
  expect(offscreen.dialogs[0]!.left).toBe(-100);
  await page.getByRole("dialog").evaluate((element) => element.remove());
  assertLayoutFit(await readLayoutFit(page));
});
