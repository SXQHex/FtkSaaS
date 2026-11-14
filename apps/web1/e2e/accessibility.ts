import AxeBuilder from "@axe-core/playwright";
import axe from "axe-core";
import { expect, test, type Page } from "@playwright/test";

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

export async function scanAccessibility(page: Page, state = "rendered-state") {
  // Scan settled colors and geometry, including newly opened modal transitions.
  await expect
    .poll(() =>
      page.evaluate(
        "document.getAnimations().filter(animation => animation.playState === 'running' || animation.pending).length",
      ),
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
