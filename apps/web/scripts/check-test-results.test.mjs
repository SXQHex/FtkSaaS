import assert from "node:assert/strict";
import { test } from "node:test";
import { checkTestResults } from "./check-test-results.mjs";

const vitest = () => ({
  success: true,
  numTotalTests: 1,
  numPassedTests: 1,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  testResults: [{ assertionResults: [{ status: "passed" }] }],
});
const playwright = () => ({
  errors: [],
  stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 },
  suites: [
    {
      specs: [
        {
          tests: [
            { expectedStatus: "passed", status: "expected", results: [{ status: "passed" }] },
          ],
        },
      ],
    },
  ],
});

test("accepts nonempty passing reports", () => {
  checkTestResults("vitest", vitest());
  checkTestResults("playwright", playwright());
});

test("rejects Vitest skips, todo, failure, empty and incomplete reports", () => {
  for (const patch of [
    { numPendingTests: 1 },
    { numTodoTests: 1 },
    { numFailedTests: 1 },
    { success: false },
    { numTotalTests: 0 },
    { testResults: [] },
    { testResults: [{ assertionResults: [{ status: "pending" }] }] },
  ])
    assert.throws(() => checkTestResults("vitest", { ...vitest(), ...patch }));
});

test("rejects Playwright skips, flaky, failure and empty reports", () => {
  for (const patch of [{ skipped: 1 }, { flaky: 1 }, { unexpected: 1 }, { expected: 0 }]) {
    const report = playwright();
    Object.assign(report.stats, patch);
    assert.throws(() => checkTestResults("playwright", report));
  }
});

test("rejects expected failures, missing results and global errors", () => {
  for (const patch of [
    { expectedStatus: "failed" },
    { results: [] },
    { results: [{ status: "skipped" }] },
    { status: "unexpected" },
  ]) {
    const report = playwright();
    Object.assign(report.suites[0].specs[0].tests[0], patch);
    assert.throws(() => checkTestResults("playwright", report));
  }
  assert.throws(() => checkTestResults("playwright", { ...playwright(), errors: [{}] }));
  assert.throws(() => checkTestResults("playwright", { ...playwright(), suites: [] }));
});

test("rejects missing, malformed and unknown report formats", () => {
  assert.throws(() => checkTestResults("vitest", {}));
  assert.throws(() => checkTestResults("playwright", {}));
  assert.throws(() => checkTestResults("unknown", {}));
});
