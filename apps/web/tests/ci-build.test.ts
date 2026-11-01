import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

const script = resolve("scripts/ci-build.mjs");
test("build transfer preserves exact output, excludes cache, and rejects stale or tampered evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "frontend-build-test-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" }).trim();
  try {
    git("init", "-q");
    git("config", "user.name", "Fixture");
    git("config", "user.email", "fixture@example.invalid");
    git("commit", "-qm", "source", "--allow-empty");
    const output = join(dir, "outputs");
    const env = {
      ...process.env,
      GITHUB_SHA: git("rev-parse", "HEAD"),
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_RUN_ID: "10",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_OUTPUT: output,
    };
    const run = (mode: string, extra: Record<string, string | undefined> = {}) =>
      execFileSync(process.execPath, [script, mode], {
        cwd: dir,
        env: { ...env, ...extra },
        stdio: "pipe",
      });
    mkdirSync(join(dir, "apps/web/.next/cache"), { recursive: true });
    writeFileSync(join(dir, "apps/web/.next/BUILD_ID"), "fixture-build");
    writeFileSync(join(dir, "apps/web/.next/cache/private"), "excluded-cache");
    run("package");
    const outputs = Object.fromEntries(
      readFileSync(output, "utf8")
        .trim()
        .split("\n")
        .map((line) => line.split("=")),
    );
    const expected = {
      EXPECTED_BUILD_SHA256: outputs.sha256,
      EXPECTED_BUILD_ATTEMPT: outputs.attempt,
      GITHUB_RUN_ATTEMPT: "2",
    };
    rmSync(join(dir, "apps/web/.next"), { recursive: true });
    run("restore", expected);
    expect(readFileSync(join(dir, "apps/web/.next/BUILD_ID"), "utf8")).toBe("fixture-build");
    expect(() => readFileSync(join(dir, "apps/web/.next/cache/private"))).toThrow(Error);
    for (const change of [
      { GITHUB_RUN_ID: "11" },
      { GITHUB_SHA: "a".repeat(40) },
      { GITHUB_REPOSITORY: "other/repo" },
      { EXPECTED_BUILD_ATTEMPT: "2" },
      { EXPECTED_BUILD_SHA256: "b".repeat(64) },
      { NEXT_PUBLIC_APP_ORIGIN: "https://different.invalid" },
    ])
      expect(() => run("restore", { ...expected, ...change })).toThrow(Error);
    writeFileSync(join(dir, ".artifacts/frontend-build/app.tar"), "tampered archive");
    expect(() => run("restore", expected)).toThrow(Error);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
