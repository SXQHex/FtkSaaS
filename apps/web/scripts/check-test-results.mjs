import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Reports are diagnostic input, never a source-bound merge receipt.
export function checkTestResults(kind, report) {
  if (kind === "vitest") {
    assert.equal(report.success, true, "Vitest did not succeed");
    assert.ok(report.numTotalTests > 0, "Vitest ran no tests");
    assert.equal(report.numPassedTests, report.numTotalTests, "Vitest has non-passing tests");
    for (const key of ["numFailedTests", "numPendingTests", "numTodoTests"]) {
      assert.equal(report[key], 0, `Vitest ${key} must be zero`);
    }
    const tests = report.testResults.flatMap((suite) => suite.assertionResults);
    assert.equal(tests.length, report.numTotalTests, "Incomplete Vitest report");
    assert.ok(
      tests.every((test) => test.status === "passed"),
      "Vitest skipped or failed a test",
    );
  } else if (kind === "playwright") {
    assert.equal(report.errors.length, 0, "Playwright reported global errors");
    assert.ok(report.stats.expected > 0, "Playwright ran no successful tests");
    for (const key of ["unexpected", "skipped", "flaky"]) {
      assert.equal(report.stats[key], 0, `Playwright ${key} must be zero`);
    }
    const collect = (suites) =>
      suites.flatMap((suite) => [
        ...(suite.specs ?? []).flatMap((spec) => spec.tests),
        ...collect(suite.suites ?? []),
      ]);
    const tests = collect(report.suites);
    assert.equal(tests.length, report.stats.expected, "Incomplete Playwright report");
    assert.ok(
      tests.every(
        (test) =>
          test.expectedStatus === "passed" &&
          test.status === "expected" &&
          test.results.length > 0 &&
          test.results.every((result) => result.status === "passed"),
      ),
      "Playwright skipped, failed, retried unsuccessfully or expected a failure",
    );
  } else {
    throw new Error(`Unknown report kind: ${kind}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , kind, file] = process.argv;
  checkTestResults(kind, JSON.parse(readFileSync(file, "utf8")));
  console.log(`${kind}: nonempty report, all tests passed, zero skipped/todo/flaky tests`);
}
