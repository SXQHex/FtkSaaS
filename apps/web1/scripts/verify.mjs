import { spawn, execFileSync } from "node:child_process";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, relative, sep } from "node:path";
import { checkTestResults } from "./check-test-results.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const reports = resolve(root, "test-reports");
const measurableAxeRules = new Set([
  "aria-prohibited-attr",
  "aria-required-children",
  "aria-valid-attr-value",
  "target-size",
  "th-has-data-cells",
]);

export function summarizeVerification(steps, unit, browser) {
  let status =
    steps.length > 0 && steps.every((step) => step.status === "passed") ? "passed" : "failed";
  let reportError;
  try {
    checkTestResults("vitest", unit);
    checkTestResults("playwright", browser);
  } catch (error) {
    status = "failed";
    reportError = error.message;
  }
  const scans = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.name === "WCAG-2.2-AA-scan-summary" && value.body) {
      const scan = JSON.parse(Buffer.from(value.body, "base64").toString("utf8"));
      if (
        ![scan.evaluatedConformanceRules, scan.violations, scan.manualReview].every(
          Array.isArray,
        ) ||
        (scan.emptyGridChecks !== undefined && !Array.isArray(scan.emptyGridChecks))
      )
        throw new Error("Invalid Axe attachment");
      scans.push(scan);
    }
    for (const child of Object.values(value)) {
      if (typeof child === "object") visit(child);
    }
  };
  try {
    visit(browser);
  } catch {
    status = "failed";
    reportError = "Invalid Axe attachment";
  }
  const incomplete = [
    ...new Set(scans.flatMap((scan) => scan.manualReview.map((rule) => rule.id))),
  ];
  const browserFollowUp = new Set();
  let emptyGridChecks = 0;
  for (const scan of scans) {
    const checkedTables = new Set(
      (scan.emptyGridChecks ?? [])
        .filter(
          (check) =>
            typeof check?.selector === "string" &&
            check.hasPlaceholder === true &&
            Number.isInteger(check.columns) &&
            check.columns > 0 &&
            check.columnSpan === check.columns,
        )
        .map((check) => check.selector),
    );
    emptyGridChecks += checkedTables.size;
    for (const rule of scan.manualReview) {
      const checked =
        rule.id === "th-has-data-cells" &&
        Array.isArray(rule.targets) &&
        rule.targets.length > 0 &&
        rule.targets.every(
          (target) => Array.isArray(target) && target.length === 1 && checkedTables.has(target[0]),
        );
      if (measurableAxeRules.has(rule.id) && !checked) browserFollowUp.add(rule.id);
    }
  }
  return {
    status,
    ...(reportError ? { reportError } : {}),
    tests: { unit: unit?.numPassedTests ?? null, browser: browser?.stats?.expected ?? null },
    axe: {
      scans: scans.length,
      minimumRules: scans.length
        ? Math.min(...scans.map((scan) => scan.evaluatedConformanceRules.length))
        : 0,
      violations: [...new Set(scans.flatMap((scan) => scan.violations))],
      incomplete,
      browserFollowUp: [...browserFollowUp],
      emptyGridChecks,
    },
  };
}

async function json(path) {
  try {
    return JSON.parse(await readFile(resolve(reports, path), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    if (error instanceof SyntaxError) return { invalidReport: true };
    throw error;
  }
}

async function save(report) {
  await writeFile(resolve(reports, "verification.json"), `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Web1 verification",
    "",
    `Status: **${report.status}** · Scope: **${report.mode}** · ${report.startedAt}`,
    `Source: \`${report.source.head}\` · Working tree dirty: ${report.source.dirty}`,
    "",
    "| Check | Result | Seconds | Log |",
    "| --- | --- | ---: | --- |",
    ...report.steps.map(
      (step) =>
        `| ${step.name} | ${step.status} | ${((step.durationMs ?? 0) / 1000).toFixed(1)} | [log](verification-logs/${step.name}.log) |`,
    ),
    "",
    `Unit tests: ${report.tests?.unit ?? "not run"}; browser tests: ${report.tests?.browser ?? "not run"}.`,
    `Axe: ${report.axe?.scans ?? 0} scans; minimum ${report.axe?.minimumRules ?? 0} rules; violations: ${report.axe?.violations.join(", ") || "none reported"}.`,
    `Incomplete Axe findings: ${report.axe?.incomplete.join(", ") || "see individual reports"}.`,
    `Candidates for explicit browser checks: ${report.axe?.browserFollowUp.join(", ") || "none in this run"}.`,
    `Empty grid placeholders verified in the browser: ${report.axe?.emptyGridChecks ?? 0}.`,
    "",
    "Selected tests do not prove full-suite acceptance. Native/hosted acceptance and full WCAG compliance are not granted by this report.",
    "Axe attachments may include expected negative policy checks; test assertions remain authoritative.",
    "",
    "[JSON report](verification.json) · [Playwright report](../playwright-report/index.html)",
    "",
  ];
  if (report.reportError) lines.push(`Report validation: ${report.reportError}`, "");
  await writeFile(resolve(reports, "verification.md"), lines.join("\n"));
}

async function main() {
  const { values } = parseArgs({
    options: {
      unit: { type: "string", multiple: true },
      e2e: { type: "string", multiple: true },
      grep: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      'npm run verify [-- --unit src/features/example --e2e e2e/auth-example.spec.ts --grep "scenario"]',
    );
    return;
  }
  const mode = values.unit || values.e2e || values.grep ? "slice" : "full";
  if (process.env.CI && mode !== "full") throw new Error("CI verification must run the full suite");
  for (const input of [...(values.unit ?? []), ...(values.e2e ?? [])]) {
    const path = relative(root, resolve(root, input));
    if (path === ".." || path.startsWith(`..${sep}`) || input.startsWith("-"))
      throw new Error("Test paths must stay inside web1");
  }
  await mkdir(resolve(reports, "verification-logs"), { recursive: true });
  await mkdir(resolve(root, ".tmp"), { recursive: true });
  for (const file of ["vitest.json", "vitest.xml", "playwright.json", "playwright.xml"])
    await rm(resolve(reports, file), { force: true });
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const report = {
    status: "running",
    mode,
    startedAt: new Date().toISOString(),
    source: {
      head: git("rev-parse", "HEAD"),
      dirty: Boolean(git("status", "--porcelain", "--", ".")),
    },
    selection: { unit: values.unit ?? [], e2e: values.e2e ?? [], grep: values.grep ?? null },
    steps: [],
  };
  const env = {
    ...process.env,
    npm_config_cache: resolve(root, ".npm-cache"),
    TMPDIR: resolve(root, ".tmp"),
    TMP: resolve(root, ".tmp"),
    TEMP: resolve(root, ".tmp"),
    PLAYWRIGHT_BROWSERS_PATH: resolve(root, ".playwright-browsers"),
  };
  const staticVerificationEnv = {
    ...env,
    VITE_SUPABASE_URL: "http://127.0.0.1:4175",
    VITE_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
  };
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const plan = [
    ...["lint", "format:check", "i18n:check", "build", "test:ci:guards"].map((command) => ({
      name: command.replaceAll(":", "-"),
      args: ["run", command],
    })),
    {
      name: "unit",
      args: [
        "run",
        "test",
        "--",
        ...(values.unit ?? []),
        "--coverage",
        "--allowOnly=false",
        "--reporter=default",
        "--reporter=json",
        "--reporter=junit",
        "--outputFile.json=test-reports/vitest.json",
        "--outputFile.junit=test-reports/vitest.xml",
      ],
      validate: async () => checkTestResults("vitest", await json("vitest.json")),
    },
    {
      name: "browser",
      args: [
        "run",
        "test:e2e",
        "--",
        ...(values.e2e ?? []),
        ...(process.env.CI ? [] : ["--workers=1"]),
        ...(values.grep ? ["--grep", values.grep] : []),
      ],
      validate: async () => checkTestResults("playwright", await json("playwright.json")),
    },
  ];
  report.steps = plan.map(({ name }) => ({ name, status: "not-run" }));
  await save(report);
  for (const [index, command] of plan.entries()) {
    const step = report.steps[index],
      started = Date.now();
    const log = await open(resolve(reports, "verification-logs", `${command.name}.log`), "w");
    console.log(`Running ${command.name}…`);
    try {
      const code = await new Promise((resolveCode, reject) => {
        const child = spawn(npm, command.args, {
          cwd: root,
          env: ["build", "browser"].includes(command.name) ? staticVerificationEnv : env,
          stdio: ["ignore", log.fd, log.fd],
        });
        child.once("error", reject);
        child.once("exit", (exitCode) => resolveCode(exitCode ?? 1));
      });
      if (code !== 0) throw new Error(`${command.name} exited ${code}`);
      await command.validate?.();
      step.status = "passed";
    } catch (error) {
      step.status = "failed";
      step.error = error.message;
      process.exitCode = 1;
    } finally {
      await log.close();
      step.durationMs = Date.now() - started;
      console.log(`${command.name}: ${step.status} (${(step.durationMs / 1000).toFixed(1)}s)`);
    }
    if (step.status === "failed") break;
  }
  Object.assign(
    report,
    summarizeVerification(report.steps, await json("vitest.json"), await json("playwright.json")),
  );
  report.finishedAt = new Date().toISOString();
  await save(report);
  if (report.status !== "passed") process.exitCode = 1;
  console.log(`Report: ${resolve(reports, "verification.md")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
