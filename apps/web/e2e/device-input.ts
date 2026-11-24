import {
  test,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from "@playwright/test";
import { activeBrowserProfile } from "../scripts/playwright-device.js";

const touchContexts = new WeakMap<BrowserContext, boolean>();

export function registerTouchInput(context: BrowserContext, hasTouch: boolean) {
  touchContexts.set(context, hasTouch);
}

export function hasTouchInput(page: Page) {
  return touchContexts.get(page.context()) ?? test.info().project.use.hasTouch === true;
}

export async function newPageForCurrentDevice(
  browser: Browser,
  options?: Pick<BrowserContextOptions, "baseURL">,
) {
  const { device } = activeBrowserProfile();
  const page = await browser.newPage({
    ...device,
    locale: "tr-TR",
    serviceWorkers: "block",
    ...options,
  });
  registerTouchInput(page.context(), device.hasTouch === true);
  return page;
}

export async function activate(control: Locator, desktopKey?: "Enter" | "Space") {
  if (hasTouchInput(control.page())) {
    // React Aria uses visually hidden native inputs inside the touchable control.
    const visualLabel = control.locator("xpath=ancestor::label[@data-slot][1]");
    if (
      (await control.evaluate((element) =>
        element.matches('input:is([type="radio"], [type="checkbox"])'),
      )) &&
      (await visualLabel.count()) === 1
    ) {
      await visualLabel.tap();
    } else {
      await control.tap();
    }
  } else if (desktopKey) {
    await control.press(desktopKey);
  } else {
    await control.click();
  }
}

export async function scrollTouchRegion(region: Locator, direction: "down" | "up" | "right") {
  const page = region.page();
  if (!hasTouchInput(page)) throw new Error("A touch context is required");
  await region.scrollIntoViewIfNeeded();
  if (page.context().browser()?.browserType().name() === "webkit") {
    // Playwright WebKit can tap but cannot inject a trusted multi-event swipe.
    // Exercise the browser's overflow and scroll position on the same container.
    await region.evaluate((element, direction) => {
      element.scrollBy({
        left: direction === "right" ? element.clientWidth / 2 : 0,
        top: direction === "right" ? 0 : (direction === "down" ? 1 : -1) * element.clientHeight,
        behavior: "instant",
      });
    }, direction);
    return;
  }
  const box = await region.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error("The touch scroll region must be visible");
  const left = Math.max(0, box.x);
  const top = Math.max(0, box.y);
  const width = Math.min(viewport.width, box.x + box.width) - left;
  const height = Math.min(viewport.height, box.y + box.height) - top;
  if (width <= 0 || height <= 0) throw new Error("The touch scroll region is outside the viewport");
  const horizontal = direction === "right";
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.synthesizeScrollGesture", {
      x: Math.round(left + width / 2),
      y: Math.round(top + height / 2),
      xDistance: horizontal ? -Math.round(width * 0.55) : 0,
      yDistance: horizontal ? 0 : (direction === "down" ? -1 : 1) * Math.round(height * 0.7),
      gestureSourceType: "touch",
      preventFling: true,
    });
  } finally {
    await session.detach();
  }
}

export async function submitWithDevice(button: Locator, field?: Locator) {
  const page = button.page();
  if (hasTouchInput(page)) await button.tap();
  else if (field) await field.press("Enter");
  else await page.keyboard.press("Enter");
}

// Dialogs can fill a touch viewport. In that case there is no outside point
// to tap, so the locked-overlay check verifies the absence of an active exit.
export async function attemptOutsideDismissal(dialog: Locator) {
  const page = dialog.page();
  if (!hasTouchInput(page)) {
    await page.keyboard.press("Escape");
    return;
  }
  const point = await dialog.evaluate((element) => {
    const doc = element.ownerDocument;
    const content = element.closest('[data-slot$="-content"]') ?? element;
    const backdrop = content.closest('[data-slot$="-overlay"]');
    if (!backdrop) return null;
    const { clientWidth: width, clientHeight: height } = doc.documentElement;
    const points = [
      [4, 4],
      [width - 4, 4],
      [4, height - 4],
      [width - 4, height - 4],
    ];
    return points.find(([x, y]) => doc.elementFromPoint(x, y) === backdrop) ?? null;
  });
  if (point) {
    await page.touchscreen.tap(point[0]!, point[1]!);
  } else {
    const controls = dialog.getByRole("button", { name: /^(Close|Kapat|Vazgeç|Paneli kapat)$/ });
    for (const control of await controls.all()) {
      if (await control.isEnabled())
        throw new Error("The locked overlay has an active close control");
    }
  }
}

export async function closeWithDevice(control: Locator) {
  if (hasTouchInput(control.page())) await control.tap();
  else await control.page().keyboard.press("Escape");
}
