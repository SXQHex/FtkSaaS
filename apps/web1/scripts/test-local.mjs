import { spawn, execFileSync } from "node:child_process";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { checkTestResults } from "./check-test-results.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));

export function localTestPlan(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      unit: { type: "string", multiple: true },
      e2e: { type: "string", multiple: true },
      grep: { type: "string" },
    },
  });
  if (!values.unit?.length && !values.e2e?.length)
    throw new Error(
      "Select --unit src/... and/or --e2e e2e/...spec.ts; use verify for full acceptance.",
    );
  for (const [kind, paths] of [
    ["src", values.unit ?? []],
    ["e2e", values.e2e ?? []],
  ])
    for (const path of paths)
      if (
        !path.startsWith(`${kind}/`) ||
        path.split("/").includes("..") ||
        !resolve(root, path).startsWith(resolve(root, kind) + "/")
      )
        throw new Error("Test paths must stay inside their source/test directory");
  if (values.grep && !values.e2e?.length) throw new Error("--grep requires --e2e");
  return [
    ...(values.unit?.length
      ? [
          {
            name: "unit",
            kind: "vitest",
            report: "local-vitest.json",
            args: [
              "run",
              "test",
              "--",
              ...values.unit,
              "--maxWorkers=2",
              "--allowOnly=false",
              "--reporter=default",
              "--reporter=json",
              "--outputFile.json=test-reports/local-vitest.json",
            ],
          },
        ]
      : []),
    ...(values.e2e?.length
      ? [
          {
            name: "browser",
            kind: "playwright",
            report: "playwright.json",
            args: [
              "run",
              "test:e2e",
              "--",
              ...values.e2e,
              "--workers=2",
              ...(values.grep ? ["--grep", values.grep] : []),
            ],
          },
        ]
      : []),
  ];
}
export async function runLocalTests(argv) {
  const plan = localTestPlan(argv),
    startedAt = new Date().toISOString(),
    started = Date.now();
  const reports = resolve(root, "test-reports"),
    logs = resolve(reports, "local-logs");
  await Promise.all([
    mkdir(logs, { recursive: true }),
    mkdir(resolve(root, ".tmp"), { recursive: true }),
  ]);
  const source = {
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    dirty: Boolean(
      execFileSync("git", ["status", "--porcelain", "--", "."], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
    ),
  };
  const env = {
    ...process.env,
    npm_config_cache: resolve(root, ".npm-cache"),
    TMPDIR: resolve(root, ".tmp"),
    TMP: resolve(root, ".tmp"),
    TEMP: resolve(root, ".tmp"),
    PLAYWRIGHT_BROWSERS_PATH: resolve(root, ".playwright-browsers"),
  };
  const results = await Promise.all(
    plan.map(async (job) => {
      await rm(resolve(reports, job.report), { force: true });
      const log = await open(resolve(logs, `${job.name}.log`), "w"),
        began = Date.now();
      let error, count;
      console.log(`Starting ${job.name}…`);
      try {
        const code = await new Promise((done, reject) => {
          const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", job.args, {
            cwd: root,
            env,
            stdio: ["ignore", log.fd, log.fd],
          });
          child.once("error", reject);
          child.once("exit", (code, signal) => done(signal ? 1 : (code ?? 1)));
        });
        if (code !== 0) throw new Error(`Command exited ${code}`);
        const report = JSON.parse(await readFile(resolve(reports, job.report), "utf8"));
        checkTestResults(job.kind, report);
        count = job.kind === "vitest" ? report.numPassedTests : report.stats.expected;
      } catch (failure) {
        error = failure.message;
      } finally {
        await log.close();
      }
      const result = {
        name: job.name,
        status: error ? "failed" : "passed",
        ...(error ? { error } : {}),
        tests: count,
        startedAt: new Date(began).toISOString(),
        durationMs: Date.now() - began,
        report: job.report,
        log: `local-logs/${job.name}.log`,
      };
      console.log(`${job.name}: ${result.status}`);
      return result;
    }),
  );
  const report = {
    status: results.every((row) => row.status === "passed") ? "passed" : "failed",
    mode: "local-selected-tests",
    source,
    startedAt,
    durationMs: Date.now() - started,
    selection: argv,
    results,
  };
  await writeFile(
    resolve(reports, "local-verification.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await writeFile(
    resolve(reports, "local-verification.md"),
    [
      "# Web1 local tests",
      "",
      `Status: **${report.status}** · ${(report.durationMs / 1000).toFixed(1)}s · ${startedAt}`,
      `Source: ${source.head} · dirty: ${source.dirty}`,
      "",
      "| Scope | Status | Tests | Evidence |",
      "| --- | --- | ---: | --- |",
      ...results.map(
        (row) =>
          `| ${row.name} | ${row.status} | ${row.tests ?? "unknown"} | [log](${row.log}) · [raw report](${row.report}) |`,
      ),
      "",
      "Selected local tests run concurrently, without build, coverage or the full verify chain. Full acceptance gates remain in npm run verify / verify:ci. Axe findings and layout evidence are attached to the browser report.",
      "",
    ].join("\n"),
  );
  console.log(`Report: ${resolve(reports, "local-verification.md")}`);
  return report.status === "passed" ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = await runLocalTests(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
