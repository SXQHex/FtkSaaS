import type { Page } from "@playwright/test";
import { scanAccessibility } from "./accessibility.js";

// Evidence for human review of Axe's incomplete results, without suppressing rules.
export async function reviewStudioAccessibility(page: Page, state: string) {
  const result = await scanAccessibility(page, state);
  const incomplete = [];
  for (const rule of result.incomplete) {
    const nodes = [];
    for (const node of rule.nodes) {
      const selector = node.target[0];
      const geometry =
        typeof selector === "string"
          ? await page.evaluate(`(() => {
              const element = document.querySelector(${JSON.stringify(selector)});
              const style = getComputedStyle(element),
                box = element.getBoundingClientRect();
              const pixel = (color) => {
                const canvas = document.createElement('canvas');canvas.width = canvas.height = 1;
                const context = canvas.getContext('2d');context.fillStyle = color;context.fillRect(0,0,1,1);
                return Array.from(context.getImageData(0,0,1,1).data);
              };
              const backgrounds = [];
              for (let parent = element; parent; parent = parent.parentElement) {
                const value = getComputedStyle(parent);
                backgrounds.push({
                  color: value.backgroundColor,
                  rgba: pixel(value.backgroundColor),
                  opacity: value.opacity,
                  display: value.display,
                  visibility: value.visibility,
                });
              }
              const input =
                element instanceof HTMLInputElement ? element : element.querySelector("input");
              return {
                tag: element.tagName,
                role: element.getAttribute("role"),
                rect: { x: box.x, y: box.y, width: box.width, height: box.height },
                display: style.display,
                visibility: style.visibility,
                foreground: style.color,
                foregroundRGBA: pixel(style.color),
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                backgrounds,
                labels: input
                  ? Array.from(input.labels ?? [], (label) => label.textContent?.trim() ?? "")
                  : null,
                ariaLabelledby:
                  input?.getAttribute("aria-labelledby") ?? element.getAttribute("aria-labelledby"),
                visibleFocusableDescendants: Array.from(
                  element.querySelectorAll("a[href],button,input,select,[tabindex]"),
                ).filter(
                  (child) =>
                    child.tabIndex >= 0 &&
                    child.getClientRects().length > 0 &&
                    getComputedStyle(child).visibility === "visible",
                ).length,
                tableRows:
                  element
                    .closest("table,[role=grid]")
                    ?.querySelectorAll("tbody tr,[role=rowgroup] [role=row]").length ?? null,
                uncovered: [0.1, 0.5, 0.9].flatMap((x) =>
                  [0.25, 0.75].map((y) => {
                    const top = document.elementFromPoint(
                      box.x + box.width * x,
                      box.y + box.height * y,
                    );
                    return top === element || Boolean(top && element.contains(top));
                  }),
                ),
              };
            })()`)
          : null;
      nodes.push({
        target: node.target,
        geometry,
        checks: [...node.any, ...node.all, ...node.none].map((check) => ({
          id: check.id,
          message: check.message,
          data: check.data,
        })),
      });
    }
    incomplete.push({ id: rule.id, nodes });
  }
  const textSamples = await page.evaluate(`(() => {
    const elements = Array.from(document.querySelectorAll('[data-slot=sheet-description],[data-slot=field-description],.text-muted-foreground'));
    return elements.filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible').map(element => {
      const style = getComputedStyle(element), backgrounds = [];
      for(let parent = element; parent; parent = parent.parentElement) backgrounds.push(getComputedStyle(parent).backgroundColor);
      return {tag: element.tagName, foreground: style.color, backgrounds, fontSize: style.fontSize, opacity: style.opacity};
    });
  })()`);
  return {
    state,
    viewport: page.viewportSize(),
    violations: result.violations.map((rule) => rule.id),
    incomplete,
    equivalentSidebarTrigger: await page
      .locator("[data-slot=sidebar-trigger]")
      .evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        tabIndex: element.getAttribute("tabindex"),
      })),
    textSamples,
  };
}
