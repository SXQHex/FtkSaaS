import { test } from "node:test";
import assert from "node:assert/strict";
import { localTestPlan } from "./test-local.mjs";
test("local loop selects one-worker jobs in unit then browser order", () => {
  const plan = localTestPlan([
    "--unit",
    "src/features/member-profile",
    "--e2e",
    "e2e/auth-member-profile.spec.ts",
  ]);
  assert.deepEqual(
    plan.map((job) => job.name),
    ["unit", "browser"],
  );
  assert.ok(plan[0].args.includes("--maxWorkers=1"));
  assert.ok(plan[0].args.includes("--no-file-parallelism"));
  assert.ok(plan[1].args.includes("--workers=1"));
  assert.ok(
    plan.every(
      (job) =>
        !job.args.includes("--coverage") &&
        !job.args.includes("verify") &&
        !job.args.includes("build"),
    ),
  );
});
test("a failed scope can be rerun alone without rescheduling the other scope", () => {
  const plan = localTestPlan(["--e2e", "e2e/auth-member-profile.spec.ts", "--grep", "native sale"]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].name, "browser");
  assert.deepEqual(plan[0].args.slice(-2), ["--grep", "native sale"]);
});
test("empty, unknown and out-of-scope selections are rejected", () => {
  for (const args of [
    [],
    ["--unit", "../backend"],
    ["--unit", "src/../../backend"],
    ["--e2e", "src/fake.spec.ts"],
    ["--grep", "anything"],
    ["--unknown"],
  ])
    assert.throws(() => localTestPlan(args));
});
