import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeVerification } from "./verify.mjs";

const steps = [
  { name: "unit", status: "passed" },
  { name: "browser", status: "passed" },
];
const unit = {
  success: true,
  numTotalTests: 1,
  numPassedTests: 1,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  testResults: [{ assertionResults: [{ status: "passed" }] }],
};
const browser = {
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
};

test("reports fresh checked results and Axe facts without claiming manual acceptance", () => {
  const withScan = structuredClone(browser);
  withScan.suites[0].specs[0].tests[0].results[0].attachments = [
    {
      name: "WCAG-2.2-AA-scan-summary",
      body: Buffer.from(
        JSON.stringify({
          evaluatedConformanceRules: ["one", "two"],
          violations: [],
          manualReview: [{ id: "color-contrast" }, { id: "aria-valid-attr-value" }],
        }),
      ).toString("base64"),
    },
  ];
  const report = summarizeVerification(steps, unit, withScan);
  assert.equal(report.status, "passed");
  assert.deepEqual(report.tests, { unit: 1, browser: 1 });
  assert.deepEqual(report.axe, {
    scans: 1,
    minimumRules: 2,
    violations: [],
    incomplete: ["color-contrast", "aria-valid-attr-value"],
    browserFollowUp: ["aria-valid-attr-value"],
    emptyGridChecks: 0,
    emptyActionCellChecks: 0,
    gridButtonChecks: 0,
  });
});

test("an empty-grid check resolves only its measured Axe targets for browser follow-up", () => {
  const checked = structuredClone(browser);
  const scan = {
    evaluatedConformanceRules: ["th-has-data-cells"],
    violations: [],
    manualReview: [{ id: "th-has-data-cells", targets: [["#empty"]] }],
    emptyGridChecks: [{ selector: "#empty", columns: 4, columnSpan: 4, hasPlaceholder: true }],
  };
  const summarize = () => {
    checked.suites[0].specs[0].tests[0].results[0].attachments = [
      {
        name: "WCAG-2.2-AA-scan-summary",
        body: Buffer.from(JSON.stringify(scan)).toString("base64"),
      },
    ];
    return summarizeVerification(steps, unit, checked).axe;
  };
  const proof = summarize();
  assert.deepEqual(proof.incomplete, ["th-has-data-cells"]);
  assert.deepEqual(proof.browserFollowUp, []);
  assert.equal(proof.emptyGridChecks, 1);

  scan.manualReview[0].targets.push(["#unmeasured"]);
  assert.deepEqual(summarize().browserFollowUp, ["th-has-data-cells"]);
  scan.emptyGridChecks[0].columnSpan = 3;
  assert.equal(summarize().emptyGridChecks, 0);
});

test("an empty action cell measurement applies only to its exact target without removing Axe results", () => {
  const checked = structuredClone(browser);
  const scan = {
    evaluatedConformanceRules: ["target-size"],
    violations: ["target-size"],
    manualReview: [{ id: "target-size", targets: [["#empty"]] }],
    gridTargetChecks: [{ selector: "#empty", check: "empty-action" }],
  };
  const summarize = () => {
    checked.suites[0].specs[0].tests[0].results[0].attachments = [
      {
        name: "WCAG-2.2-AA-scan-summary",
        body: Buffer.from(JSON.stringify(scan)).toString("base64"),
      },
    ];
    return summarizeVerification(steps, unit, checked).axe;
  };
  assert.deepEqual(summarize().browserFollowUp, []);
  assert.deepEqual(summarize().incomplete, ["target-size"]);
  assert.deepEqual(summarize().violations, ["target-size"]);
  assert.equal(summarize().emptyActionCellChecks, 1);

  scan.manualReview[0].targets.push(["#live-control"]);
  assert.deepEqual(summarize().browserFollowUp, ["target-size"]);
  scan.gridTargetChecks.push({ selector: "#live-control", check: "button-size" });
  assert.deepEqual(summarize().browserFollowUp, []);
  assert.equal(summarize().gridButtonChecks, 1);
});

test("a failed or unexecuted gate cannot be hidden by old successful test reports", () => {
  for (const status of ["failed", "not-run"]) {
    assert.equal(
      summarizeVerification([...steps, { name: "build", status }], unit, browser).status,
      "failed",
    );
  }
  assert.equal(summarizeVerification([], unit, browser).status, "failed");
});

test("empty, pending, missing and flaky test reports remain failures", () => {
  for (const report of [
    undefined,
    { ...unit, numTotalTests: 0 },
    { ...unit, numPendingTests: 1 },
    { ...unit, success: false },
  ]) {
    assert.equal(summarizeVerification(steps, report, browser).status, "failed");
  }
  assert.equal(
    summarizeVerification(steps, unit, { ...browser, stats: { ...browser.stats, flaky: 1 } })
      .status,
    "failed",
  );
});

test("an unreadable Axe attachment fails reporting rather than silently dropping the scan", () => {
  const broken = structuredClone(browser);
  broken.suites[0].specs[0].tests[0].results[0].attachments = [
    { name: "WCAG-2.2-AA-scan-summary", body: Buffer.from("invalid JSON").toString("base64") },
  ];
  assert.equal(summarizeVerification(steps, unit, broken).status, "failed");
});
