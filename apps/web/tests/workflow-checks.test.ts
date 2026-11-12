// @vitest-environment node
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";
import { parse } from "yaml";
const root = resolve("../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const roots: string[] = [];
afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true });
});
test("workflow validators run all four tools without optional failure or privileged triggers", () => {
  const workflow = parse(read(".github/workflows/workflow-checks.yml"));
  expect(workflow.permissions).toEqual({});
  expect(Object.keys(workflow.on)).toEqual(["pull_request"]);
  expect(workflow.concurrency["cancel-in-progress"]).toBe(true);
  const job = workflow.jobs.validate;
  expect(job.permissions).toEqual({ contents: "read" });
  expect(job["timeout-minutes"]).toBeLessThanOrEqual(10);
  for (const name of ["Actionlint", "Zizmor", "Poutine", "Pinact"]) {
    const step = job.steps.find((item: { name?: string }) => item.name === name);
    expect(step).toBeDefined();
    expect(step["continue-on-error"]).toBeUndefined();
    expect(step.if).toContain("!cancelled()");
    expect(step.if).toContain("steps.install.outcome == 'success'");
  }
  expect(job.steps.find((step: { name?: string }) => step.name === "Poutine").run).toContain(
    "--fail-on-violation",
  );
  expect(job.steps.find((step: { name?: string }) => step.name === "Pinact").run).toContain(
    "--check --verify-comment --min-age 7 --verify-min-age",
  );
  expect(job.steps.find((step: { name?: string }) => step.name === "Zizmor").run).toContain(
    "--config apps/web/scripts/workflow-validation/zizmor.yml",
  );
  expect(job.steps.find((step: { name?: string }) => step.name === "Poutine").run).toContain(
    "--config apps/web/scripts/workflow-validation/poutine.yml",
  );
});
test("frontend packages use exact third-party versions and Node 24 types", () => {
  for (const path of ["apps/web/package.json", "packages/ui/package.json"]) {
    const manifest = JSON.parse(read(path));
    for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const [name, version] of Object.entries(manifest[section] ?? {})) {
        if (name.startsWith("@ftksaas/") || (name === "typescript" && version === "catalog:"))
          continue;
        expect(version, `${path}: ${name}`).toMatch(/^\d+\.\d+\.\d+$/);
      }
    }
    expect(manifest.devDependencies["@types/node"]).toMatch(/^24\.\d+\.\d+$/);
  }
});
test("validator installer rejects an altered archive before tar can extract or execute it", () => {
  const path = mkdtempSync(join(tmpdir(), "ftk-workflow-tools-"));
  roots.push(path);
  const bin = join(path, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "curl"),
    '#!/usr/bin/env bash\nwhile [ "$#" -gt 0 ]; do if [ "$1" = "-o" ]; then printf tampered > "$2"; exit 0; fi; shift; done\nexit 1\n',
  );
  writeFileSync(join(bin, "tar"), "#!/usr/bin/env bash\nexit 99\n");
  chmodSync(join(bin, "curl"), 0o755);
  chmodSync(join(bin, "tar"), 0o755);
  const result = spawnSync(
    "bash",
    [join(root, "apps/web/scripts/workflow-validation/install-tools.sh"), join(path, "tools")],
    { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } },
  );
  expect(result.status).toBe(1);
  expect(result.stdout).not.toContain("Installed");
  expect(() =>
    execFileSync("bash", [
      "-n",
      join(root, "apps/web/scripts/workflow-validation/install-tools.sh"),
    ]),
  ).not.toThrow();
});
test("Poutine exception remains limited to read-only, secret-free verified candidate jobs", () => {
  const config = parse(read("apps/web/scripts/workflow-validation/poutine.yml"));
  expect(config.skip).toEqual([
    {
      rule: "untrusted_checkout_exec",
      path: ".github/workflows/clean-suite.yml",
      job: ["core", "api", "serial-reference"],
    },
  ]);
  const workflow = parse(read(".github/workflows/clean-suite.yml"));
  for (const name of config.skip[0].job) {
    const job = workflow.jobs[name];
    expect(job.permissions).toEqual({ contents: "read" });
    expect(JSON.stringify(job)).not.toContain("secrets.");
    expect(job.steps[0].with["persist-credentials"]).toBe(false);
    const proof = job.steps.findIndex(
      (step: { name?: string }) => step.name === "Verify tested merge",
    );
    expect(proof).toBe(1);
    expect(job.steps[proof].run).toContain("HEAD^{tree}");
    expect(job.steps[proof].run).toContain("Source mismatch");
  }
});
test("Zizmor exceptions stay anchored to the reviewed trigger or reusable workflow line", () => {
  const config = parse(read("apps/web/scripts/workflow-validation/zizmor.yml"));
  expect(Object.keys(config.rules)).toEqual(["dangerous-triggers", "self-repository"]);
  const expected = {
    "dangerous-triggers": [
      "cd-development.yml:4:3",
      "vercel.yml:3:3",
      "ci-gate.yml:4:3",
      "ci-gate.yml:7:3",
    ],
    "self-repository": ["ci-full.yml:144:11"],
  };
  for (const [name, locations] of Object.entries(expected)) {
    expect(config.rules[name]).toEqual({ ignore: locations });
    for (const location of locations) {
      const [file, line] = location.split(":");
      const source = read(`.github/workflows/${file}`).split("\n")[Number(line) - 1];
      expect(source).toMatch(
        name === "dangerous-triggers"
          ? /^\s+(workflow_run|pull_request_target):/
          : /^\s+uses: \.\/.github\/workflows\/clean-suite.yml$/,
      );
    }
  }
});
