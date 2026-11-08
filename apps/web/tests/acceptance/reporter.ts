import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

// Never serialize Playwright errors, call logs, DOM, headers or attachments:
// real Auth/API traces can include bearer tokens even for synthetic accounts.
export default class AcceptanceReporter implements Reporter {
  onError() {
    console.error("Batch setup/collection failed. No account details recorded.");
  }
  private rows: { project: string; title: string; status: string; duration: number }[] = [];
  onTestEnd(test: TestCase, result: TestResult) {
    const row = {
      project: test.parent.project()?.name ?? "",
      title: test.title,
      status: result.status,
      duration: result.duration,
    };
    this.rows.push(row);
    console.log(`${row.project}: ${row.title}: ${row.status}`);
  }
  async onEnd(result: FullResult) {
    const directory = fileURLToPath(
      new URL("../../../../.artifacts/frontend/live-batch/", import.meta.url),
    );
    mkdirSync(directory, { recursive: true });
    const projects = new Set(this.rows.map((row) => row.project));
    const complete =
      result.status === "passed" &&
      projects.size === 4 &&
      this.rows.every((row) => row.status === "passed");
    writeFileSync(
      `${directory}/results.json`,
      JSON.stringify(
        {
          status: complete ? "passed" : "failed",
          runnerStatus: result.status,
          complete,
          tests: this.rows,
        },
        null,
        2,
      ),
    );
    // An empty or skipped batch is never acceptance evidence.
    if (!complete) return { status: "failed" as const };
  }
}
