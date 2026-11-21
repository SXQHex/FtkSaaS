import { expect, test, type Page } from "@playwright/test";
interface LayoutFit {
  width: number;
  height: number;
  documentWidth: number;
  dialogs: { left: number; right: number; top: number; bottom: number; name: string | null }[];
}
export async function readLayoutFit(page: Page): Promise<LayoutFit> {
  // This callback runs in the browser, while the runner intentionally has Node-only globals.
  return page.evaluate<LayoutFit>(`(() => ({
    width: document.documentElement.clientWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].flatMap(element => {
      const rect = element.getBoundingClientRect();
      return rect.width && rect.height && getComputedStyle(element).visibility !== "hidden"
        ? [{ left:rect.left, right:rect.right, top:rect.top, bottom:rect.bottom, name:element.getAttribute("aria-labelledby") ?? element.getAttribute("aria-label") }]
        : [];
    }),
  }))()`);
}
export function assertLayoutFit(layout: Awaited<ReturnType<typeof readLayoutFit>>) {
  expect(layout.documentWidth, "The page must not overflow horizontally").toBeLessThanOrEqual(
    layout.width + 1,
  );
  for (const dialog of layout.dialogs) {
    expect(dialog.left, "Dialog left edge").toBeGreaterThanOrEqual(-1);
    expect(dialog.right, "Dialog right edge").toBeLessThanOrEqual(layout.width + 1);
    expect(dialog.top, "Dialog top edge").toBeGreaterThanOrEqual(-1);
    expect(dialog.bottom, "Dialog bottom edge").toBeLessThanOrEqual(layout.height + 1);
  }
}
export async function verifyResponsiveLayout(page: Page) {
  const original = page.viewportSize();
  const rootZoom = await page.evaluate<number>(
    "parseFloat(getComputedStyle(document.documentElement).zoom) || 1",
  );
  const observations: (LayoutFit & { cssWidth: number })[] = [];
  try {
    for (const cssWidth of [1440, 320]) {
      // CSS zoom in a scenario scales the layout without resizing the Playwright viewport.
      const width = Math.ceil(cssWidth * rootZoom);
      await page.setViewportSize({ width, height: original?.height ?? 900 });
      // Let media-query listeners replace the sidebar before measuring the new viewport.
      await page.evaluate(
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))",
      );
      await expect(async () => {
        const layout = await readLayoutFit(page);
        assertLayoutFit(layout);
        observations.push({ ...layout, cssWidth });
      }, `Page and dialogs must fit ${cssWidth} CSS px`).toPass({ timeout: 5_000 });
    }
  } finally {
    if (original && !page.isClosed()) await page.setViewportSize(original);
    await test.info().attach("responsive-layout-summary", {
      body: JSON.stringify({ scenario: test.info().title, observations }, null, 2),
      contentType: "application/json",
    });
  }
}
