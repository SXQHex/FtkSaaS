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
    width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
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
      await expect
        .poll(
          async () => {
            const layout = await readLayoutFit(page);
            return (
              layout.documentWidth <= layout.width + 1 &&
              layout.dialogs.every(
                (rect) =>
                  rect.left >= -1 &&
                  rect.right <= layout.width + 1 &&
                  rect.top >= -1 &&
                  rect.bottom <= layout.height + 1,
              )
            );
          },
          { message: `Page and dialogs must fit ${cssWidth} CSS px` },
        )
        .toBe(true);
      const layout = await readLayoutFit(page);
      observations.push({ ...layout, cssWidth });
      assertLayoutFit(layout);
    }
  } finally {
    if (original && !page.isClosed()) await page.setViewportSize(original);
    await test.info().attach("responsive-layout-summary", {
      body: JSON.stringify({ scenario: test.info().title, observations }, null, 2),
      contentType: "application/json",
    });
  }
}
