import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Reporter from "../tests/acceptance/reporter.ts";

const report = new URL("../../../.artifacts/frontend/live-batch/results.json", import.meta.url);
function row(reporter, project, status = "passed") {
  reporter.onTestEnd(
    { title: "static scenario", parent: { project: () => ({ name: project }) } },
    {
      status,
      duration: 1,
      error: { message: "PRIVATE_BEARER_MUST_NOT_APPEAR" },
      attachments: [{ body: "PRIVATE_ACCOUNT_MUST_NOT_APPEAR" }],
    },
  );
}
test("empty evidence fails closed", async () => {
  assert.deepEqual(await new Reporter().onEnd({ status: "passed" }), { status: "failed" });
});
test("a selected project is not complete batch evidence", async () => {
  const reporter = new Reporter();
  row(reporter, "pro-manager");
  assert.deepEqual(await reporter.onEnd({ status: "passed" }), { status: "failed" });
});
test("complete batch emits only static case status and timing", async () => {
  const reporter = new Reporter();
  for (const project of ["pro-manager", "starter-manager", "pro-instructor", "pro-student"])
    row(reporter, project);
  assert.equal(await reporter.onEnd({ status: "passed" }), undefined);
  const text = readFileSync(report, "utf8");
  assert.equal(JSON.parse(text).complete, true);
  assert.equal(text.includes("PRIVATE_"), false);
});
test("skipped case prevents successful batch evidence", async () => {
  const reporter = new Reporter();
  for (const project of ["pro-manager", "starter-manager", "pro-instructor", "pro-student"])
    row(reporter, project);
  row(reporter, "pro-student", "skipped");
  assert.deepEqual(await reporter.onEnd({ status: "passed" }), { status: "failed" });
});
