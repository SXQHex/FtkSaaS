import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyShardPlan, verifyShardResult } from "./ci-e2e.mjs";
import { refactoringBrowserShards } from "./browser-profiles.mjs";

const profile = "mobile-webkit";

function report(ids, options = {}) {
  return {
    errors: [],
    stats: { expected: ids.length, unexpected: 0, skipped: 0, flaky: 0 },
    suites: [
      {
        specs: ids.map((id) => ({
          id,
          file: "static-build.spec.ts",
          tests: [
            {
              projectId: profile,
              expectedStatus: "passed",
              status: "expected",
              results: [{ status: "passed" }],
              ...options,
            },
          ],
        })),
      },
    ],
  };
}

test("three browser shards must cover the selected inventory once", () => {
  const all = report(["first", "second", "third"]);
  const shards = ["first", "second", "third"].map((id) => report([id]));
  const files = ["static-build.spec.ts"];
  const expected = verifyShardPlan(all, shards, files, profile);
  verifyShardResult(shards[0], expected[0], profile);
  assert.throws(() => verifyShardPlan(all, shards.slice(1), files, profile), /Incomplete/);
  assert.throws(
    () => verifyShardPlan(all, [shards[0], shards[0], shards[2]], files, profile),
    /gaps or duplicates/,
  );
  assert.throws(() => verifyShardPlan(all, shards, ["absent.spec.ts"], profile), /missing/);
  assert.throws(() => verifyShardResult(shards[1], expected[0], profile), /does not match/);
  assert.throws(
    () => verifyShardResult(report(["first"], { projectId: "chromium" }), expected[0], profile),
    /wrong project/,
  );
  assert.throws(
    () => verifyShardResult(report(["first"], { expectedStatus: "skipped" }), expected[0], profile),
    /skipped/,
  );
});

test("twelve Desktop Chromium shards must cover every selected test once", () => {
  const ids = refactoringBrowserShards.map((index) => `case-${index}`);
  const all = report(ids, { projectId: "chromium" });
  const shards = ids.map((id) => report([id], { projectId: "chromium" }));
  const files = ["static-build.spec.ts"];
  const plan = verifyShardPlan(all, shards, files, "chromium", refactoringBrowserShards);
  assert.equal(plan.length, 12);
  for (const [index, shard] of shards.entries()) verifyShardResult(shard, plan[index], "chromium");
  assert.throws(
    () => verifyShardPlan(all, shards.slice(1), files, "chromium", refactoringBrowserShards),
    /Incomplete/,
  );
  assert.throws(
    () => verifyShardPlan(all, [...shards.slice(0, 11), shards[0]], files, "chromium", refactoringBrowserShards),
    /gaps or duplicates/,
  );
});
