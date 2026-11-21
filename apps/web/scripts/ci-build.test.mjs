import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./ci-build.mjs", import.meta.url));

test("only mobile WebKit on macOS ARM64 restores the source-bound Ubuntu build across OSes", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ftk-ci-build-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "apps/web/dist"), { recursive: true });
  const index = join(dir, "apps/web/dist/index.html");
  const html = '<script src="/assets/app.js"></script>';
  writeFileSync(index, html);

  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "--quiet");
  git(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "--allow-empty",
    "-qm",
    "fixture",
  );
  const env = {
    GITHUB_REPOSITORY: "fixture/repo",
    GITHUB_RUN_ID: "1",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_SHA: git("rev-parse", "HEAD"),
    GITHUB_OUTPUT: join(dir, "output"),
    VITE_TEST_INPUT: "same",
  };
  const run = (mode, platform, arch, overrides = {}) => {
    const identity = `Object.defineProperties(process, {platform:{value:${JSON.stringify(platform)}}, arch:{value:${JSON.stringify(arch)}}})`;
    return spawnSync(
      process.execPath,
      ["--import", `data:text/javascript,${encodeURIComponent(identity)}`, script, mode],
      {
        cwd: dir,
        env: { PATH: process.env.PATH, ...env, ...overrides },
        encoding: "utf8",
      },
    );
  };

  const build = run("package", "linux", "x64");
  assert.equal(build.status, 0, build.stderr);
  const binding = JSON.parse(
    readFileSync(join(dir, ".artifacts/frontend-build/binding.json"), "utf8"),
  );
  const expected = {
    EXPECTED_BUILD_SHA256: binding.sha256,
    EXPECTED_BUILD_ATTEMPT: "1",
  };
  const mobile = { ...expected, FTK_BROWSER_PROJECT: "mobile-webkit" };

  writeFileSync(index, "stale build");
  const linux = run("restore", "linux", "x64", { ...expected, FTK_BROWSER_PROJECT: "webkit" });
  assert.equal(linux.status, 0, linux.stderr);
  assert.equal(readFileSync(index, "utf8"), html);

  writeFileSync(index, "stale build");
  const mac = run("restore", "darwin", "arm64", mobile);
  assert.equal(mac.status, 0, mac.stderr);
  assert.equal(readFileSync(index, "utf8"), html);

  const desktopOnMac = run("restore", "darwin", "arm64", {
    ...expected,
    FTK_BROWSER_PROJECT: "webkit",
  });
  assert.equal(desktopOnMac.status, 1);
  assert.match(desktopOnMac.stderr, /BUILD_BINDING_MISMATCH/);

  const wrongRunner = run("restore", "linux", "x64", mobile);
  assert.equal(wrongRunner.status, 1);
  assert.match(wrongRunner.stderr, /BUILD_RUNNER_MISMATCH/);

  const wrongInputs = run("restore", "darwin", "arm64", {
    ...mobile,
    VITE_TEST_INPUT: "different",
  });
  assert.equal(wrongInputs.status, 1);
  assert.match(wrongInputs.stderr, /BUILD_BINDING_MISMATCH/);

  appendFileSync(join(dir, ".artifacts/frontend-build/app.tar"), "tampered");
  const tampered = run("restore", "darwin", "arm64", mobile);
  assert.equal(tampered.status, 1);
  assert.match(tampered.stderr, /BUILD_DIGEST_MISMATCH/);
  assert.equal(readFileSync(index, "utf8"), html);
});
