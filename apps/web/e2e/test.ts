import { test as base, expect } from "@playwright/test";
import { verifyResponsiveLayout } from "./layout.js";
import { registerTouchInput } from "./device-input.js";
import { scanAccessibility } from "./accessibility.js";

// Every product flow receives the same final-state scan in addition to its state-specific scans.
export const test = base.extend<{ wcag22AA: true }>({
  page: async ({ page, hasTouch }, providePage) => {
    registerTouchInput(page.context(), hasTouch);
    await providePage(page);
  },
  wcag22AA: [
    async ({ page }, use) => {
      await use(true);
      if (!page.isClosed()) {
        // Modal dialogs aria-hide the background while its rendered page remains mounted.
        await expect(page.locator("main")).toBeVisible();
        await expect(page.locator("main h1")).toBeVisible();
        expect((await scanAccessibility(page, "flow-final-state")).violations).toEqual([]);
        await verifyResponsiveLayout(page);
      }
    },
    { auto: true },
  ],
});
export { expect };
