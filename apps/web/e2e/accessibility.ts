import AxeBuilder from "@axe-core/playwright";
import axe, { type Result } from "axe-core";
import { expect, test, type Locator, type Page } from "@playwright/test";

const conformanceTags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
  "best-practice",
];
const conformanceRules = axe.getRules(conformanceTags).map((rule) => rule.ruleId);
type GridTargetCheck = "empty-action" | "button-size";
const measuredGridCells = new WeakMap<Page, Map<string, GridTargetCheck>>();

async function gridCellSelector(cell: Locator) {
  await expect(cell).toHaveAttribute("data-slot", "table-cell");
  const id = await cell.getAttribute("id");
  if (!id || !/^[A-Za-z][\w-]*$/.test(id)) throw new Error("Grid cell has no CSS-safe identifier");
  return `#${id}`;
}

function recordGridTarget(page: Page, selector: string, check: GridTargetCheck) {
  const checked = measuredGridCells.get(page) ?? new Map<string, GridTargetCheck>();
  checked.set(selector, check);
  measuredGridCells.set(page, checked);
}

export async function expectEmptyActionCell(cell: Locator) {
  await expect(cell).toBeEmpty();
  // React Aria can move the grid's roving tab stop to a cell that has no action.
  await expect(cell).toHaveAttribute("tabindex", /^(0|-1)$/);
  const selector = await gridCellSelector(cell);
  const page = cell.page();
  const isActionlessCell = await page.evaluate<boolean>(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    return Boolean(element?.matches('td[role="gridcell"]') &&
      element.cellIndex === element.parentElement.cells.length - 1 &&
      !element.closest('[role="link"], [role="button"]') &&
      getComputedStyle(element).cursor !== 'pointer');
  })()`);
  expect(isActionlessCell).toBe(true);
  recordGridTarget(page, selector, "empty-action");
}

async function expectMinimumButtonSize(button: Locator) {
  const target = await button.boundingBox();
  expect(target?.width).toBeGreaterThanOrEqual(24);
  expect(target?.height).toBeGreaterThanOrEqual(24);
}

export async function expectGridButtonTarget(button: Locator) {
  const cell = button.locator('xpath=ancestor::td[@role="gridcell"][1]');
  const selector = await gridCellSelector(cell);
  await expect(cell.getByRole("button")).toHaveCount(1);
  await expect(cell.getByRole("link")).toHaveCount(0);
  await button.click({ trial: true });
  await expectMinimumButtonSize(button);
  recordGridTarget(button.page(), selector, "button-size");
}

async function checkEmptyGrids(page: Page, incomplete: readonly Result[]) {
  const selectors = incomplete
    .find((rule) => rule.id === "th-has-data-cells")
    ?.nodes.flatMap(({ target }) =>
      target.length === 1 && typeof target[0] === "string" ? [target[0]] : [],
    );
  if (!selectors?.length) return [];

  const checks = await page.evaluate<
    { selector: string; columns: number; columnSpan: number; hasPlaceholder: boolean }[]
  >(`${JSON.stringify(selectors)}.flatMap((selector) => {
      const table = document.querySelector(selector);
      if (!(table instanceof HTMLTableElement) || table.dataset.slot !== "table") return [];
      const body = table.tBodies[0];
      if (!body?.hasAttribute("data-empty") || table.getAttribute("aria-busy") === "true")
        return [];
      const headers = table.tHead?.rows;
      const header = headers?.[headers.length - 1];
      const columns = Array.from(header?.cells ?? []).reduce((sum, cell) => sum + cell.colSpan, 0);
      const row = body.rows[0];
      const cell = row?.cells[0];
      return [
        {
          selector,
          columns,
          columnSpan: cell?.colSpan ?? 0,
          hasPlaceholder:
            body.rows.length === 1 &&
            row?.cells.length === 1 &&
            cell?.getAttribute("role") === "rowheader" &&
            Boolean(cell.textContent?.trim()),
        },
      ];
    })`);
  for (const check of checks) {
    expect(check.columns, check.selector).toBeGreaterThan(0);
    expect(check.columnSpan, check.selector).toBe(check.columns);
    expect(check.hasPlaceholder, check.selector).toBe(true);
  }
  return checks;
}

export async function scanAccessibility(page: Page, state = "rendered-state") {
  // Read affected styles before checking animations so WebKit registers pending transitions.
  await expect
    .poll(() =>
      page.evaluate(`new Promise(resolve => requestAnimationFrame(() => {
        for (const element of document.querySelectorAll("button, p, [data-slot$='-overlay'], [data-slot$='-content']")) {
          const style = getComputedStyle(element);
          void style.color;
          void style.opacity;
        }
        requestAnimationFrame(() => resolve(document.getAnimations().filter(
          animation => animation.playState === "running" || animation.pending
        ).length));
      }))`),
    )
    .toBe(0);
  // Preserve all default rules and explicitly enable every available WCAG 2.2 A/AA rule.
  const results = await new AxeBuilder({ page })
    .options({
      rules: Object.fromEntries(conformanceRules.map((id) => [id, { enabled: true }])),
    })
    .analyze();
  const evaluated = new Set(
    [...results.passes, ...results.violations, ...results.incomplete, ...results.inapplicable].map(
      (rule) => rule.id,
    ),
  );
  expect(
    conformanceRules.filter((id) => !evaluated.has(id)),
    "Every supported WCAG A/AA rule must run",
  ).toEqual([]);
  const emptyGridChecks = await checkEmptyGrids(page, results.incomplete);
  const measuredCells = measuredGridCells.get(page);
  const gridTargetChecks =
    results.incomplete
      .find((rule) => rule.id === "target-size")
      ?.nodes.flatMap(({ target }) => {
        const selector = target[0];
        const check = typeof selector === "string" ? measuredCells?.get(selector) : undefined;
        return target.length === 1 && typeof selector === "string" && check
          ? [{ selector, check }]
          : [];
      }) ?? [];
  for (const { selector, check } of gridTargetChecks) {
    const cell = page.locator(selector);
    if (check === "empty-action") await expect(cell).toBeEmpty();
    else await expectMinimumButtonSize(cell.getByRole("button"));
  }
  await test.info().attach("WCAG-2.2-AA-scan-summary", {
    body: JSON.stringify(
      {
        standard: "WCAG 2.2 AA",
        scenario: test.info().title,
        project: test.info().project.name,
        viewport: page.viewportSize(),
        state,
        axeVersion: results.testEngine.version,
        evaluatedConformanceRules: conformanceRules,
        violations: results.violations.map((rule) => rule.id),
        emptyGridChecks,
        gridTargetChecks,
        manualReview: results.incomplete.map((rule) => ({
          id: rule.id,
          targets: rule.nodes.map((node) => node.target),
          nodes: rule.nodes.map((node) => ({
            target: node.target,
            tag: node.html.match(/^<([a-z0-9-]+)/i)?.[1] ?? null,
            role: node.html.match(/\brole="([^"]+)"/)?.[1] ?? null,
            checks: [...node.any, ...node.all, ...node.none].map((check) => ({
              id: check.id,
              message: check.message,
              metrics: Object.fromEntries(
                Object.entries((check.data ?? {}) as Record<string, unknown>).filter(
                  ([key, value]) =>
                    [
                      "minSize",
                      "width",
                      "height",
                      "closestOffset",
                      "contrastRatio",
                      "expectedContrastRatio",
                      "fontSize",
                      "fontWeight",
                      "fgColor",
                      "bgColor",
                    ].includes(key) &&
                    (typeof value === "number" || typeof value === "string" || value === null),
                ),
              ),
            })),
          })),
        })),
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  return results;
}
