import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { browserProfiles, browserShards, refactoringBrowserShards } from "./browser-profiles.mjs";
import { checkTestResults } from "./check-test-results.mjs";

function reportTests(suites) {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []).flatMap((spec) =>
      spec.tests.map((test) => ({
        file: spec.file,
        id: `${test.projectId}/${spec.id}`,
        expectedStatus: test.expectedStatus,
      })),
    ),
    ...reportTests(suite.suites ?? []),
  ]);
}

function inventory(report, profile) {
  assert.deepEqual(report.errors, [], "Unable to discover browser tests");
  const tests = reportTests(report.suites);
  assert.ok(tests.length, "Browser test inventory is empty");
  assert.ok(
    tests.every(
      ({ id, expectedStatus }) =>
        expectedStatus === "passed" &&
        (id.startsWith(`${profile}/`) || id.startsWith(`auth-${profile}/`)),
    ),
    "Browser inventory has a wrong project or a disabled test",
  );
  return tests;
}

export function verifyShardPlan(all, shards, files, profile, plannedShards = browserShards) {
  assert.equal(shards.length, plannedShards.length, "Incomplete shard plan");
  const tests = inventory(all, profile);
  if (files.length) {
    assert.deepEqual(
      [...new Set(tests.map(({ file }) => file))].sort((a, b) => a.localeCompare(b)),
      [...files].sort((a, b) => a.localeCompare(b)),
      "A selected spec is missing from discovery",
    );
  }
  const testIds = tests.map(({ id }) => id);
  assert.equal(new Set(testIds).size, testIds.length, "Duplicate browser test IDs");
  const shardIds = shards.map((report) =>
    inventory(report, profile)
      .map(({ id }) => id)
      .sort(),
  );
  assert.deepEqual(shardIds.flat().sort(), testIds.sort(), "Shard plan has gaps or duplicates");
  return shardIds;
}

export function verifyShardResult(report, expected, profile) {
  checkTestResults("playwright", report);
  assert.deepEqual(
    inventory(report, profile)
      .map(({ id }) => id)
      .sort(),
    expected,
    "Browser report does not match the shard inventory",
  );
}

function runShard(env) {
  const profile = env.FTK_BROWSER_PROJECT;
  assert.ok(Object.hasOwn(browserProfiles, profile), "CI browser profile is required");
  // Refactoring CI runs the complete Desktop Chromium inventory in 12 shards.
  // Preserve the original three-shard plan for manual runs of other profiles.
  const plannedShards = profile === "chromium" ? refactoringBrowserShards : browserShards;
  const shard = Number(env.FTK_BROWSER_SHARD);
  assert.ok(plannedShards.includes(shard), "CI shard index is required");
  const files = JSON.parse(env.FTK_E2E_SPECS);
  assert.ok(
    Array.isArray(files) &&
      files.every((file) => typeof file === "string" && /^[a-z0-9-]+\.spec\.ts$/.test(file)),
    "Invalid affected spec list",
  );
  const args = files.map((file) => `/${file.replaceAll(".", "\\.")}$`);
  const playwright = (flags, stdio) =>
    execFileSync(process.execPath, ["scripts/playwright.mjs", "test", ...flags, ...args], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      stdio,
      env: { ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: "" },
    });
  const discover = (...flags) => JSON.parse(playwright(["--list", "--reporter=json", ...flags]));
  const shardFlag = (index) => `--shard=${index}/${plannedShards.length}`;
  const expected = verifyShardPlan(
    discover(),
    plannedShards.map((index) => discover(shardFlag(index))),
    files,
    profile,
    plannedShards,
  )[shard - 1];
  console.log(`${profile} ${shard}/${plannedShards.length}: ${expected.length} selected tests`);
  playwright([shardFlag(shard)], "inherit");
  verifyShardResult(
    JSON.parse(readFileSync("test-reports/playwright.json", "utf8")),
    expected,
    profile,
  );
  console.log("Playwright shard ran and passed its complete inventory");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) runShard(process.env);
