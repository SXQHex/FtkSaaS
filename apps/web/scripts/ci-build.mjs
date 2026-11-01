// Transfer one tested build within the same workflow run; never a cross-run cache.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const env = process.env;
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const attempt = Number(env.GITHUB_RUN_ATTEMPT);
assert(Number.isSafeInteger(attempt) && attempt > 0, "BUILD_ATTEMPT_REQUIRED");
assert.match(env.GITHUB_RUN_ID ?? "", /^[1-9]\d*$/);
assert(env.GITHUB_REPOSITORY, "BUILD_REPOSITORY_REQUIRED");
assert.equal(git("rev-parse", "HEAD"), env.GITHUB_SHA, "BUILD_SOURCE_MISMATCH");
const source = {
  version: 1,
  repository: env.GITHUB_REPOSITORY,
  run: env.GITHUB_RUN_ID,
  merge: env.GITHUB_SHA,
  tree: git("rev-parse", "HEAD^{tree}"),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  // Only a digest is recorded; never expose configuration values in artifacts/logs.
  inputs: sha256(
    JSON.stringify(
      Object.entries(env)
        .filter(([key]) => key.startsWith("NEXT_PUBLIC_"))
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  ),
};
const dir = ".artifacts/frontend-build";
const archive = resolve(dir, "app.tar");
const mode = process.argv[2];
if (mode === "package") {
  assert(readFileSync("apps/web/.next/BUILD_ID", "utf8").trim(), "PRODUCTION_BUILD_REQUIRED");
  mkdirSync(dir, { recursive: true });
  execFileSync("tar", ["--exclude=.next/cache", "-cf", archive, "-C", "apps/web", ".next"]);
  const digest = sha256(readFileSync(archive));
  writeFileSync(
    resolve(dir, "binding.json"),
    JSON.stringify({ ...source, attempt, sha256: digest }),
  );
  appendFileSync(env.GITHUB_OUTPUT, `sha256=${digest}\nattempt=${attempt}\n`);
} else if (mode === "restore") {
  const binding = JSON.parse(readFileSync(resolve(dir, "binding.json"), "utf8"));
  const buildAttempt = Number(env.EXPECTED_BUILD_ATTEMPT);
  assert(
    Number.isSafeInteger(buildAttempt) && buildAttempt > 0 && buildAttempt <= attempt,
    "BUILD_ATTEMPT_MISMATCH",
  );
  assert.match(env.EXPECTED_BUILD_SHA256 ?? "", /^[a-f0-9]{64}$/);
  assert.deepEqual(
    binding,
    { ...source, attempt: buildAttempt, sha256: env.EXPECTED_BUILD_SHA256 },
    "BUILD_BINDING_MISMATCH",
  );
  assert.equal(sha256(readFileSync(archive)), env.EXPECTED_BUILD_SHA256, "BUILD_DIGEST_MISMATCH");
  // Extract only after matching the producer job's output digest and source.
  rmSync("apps/web/.next", { recursive: true, force: true });
  execFileSync("tar", ["-xf", archive, "-C", "apps/web"]);
  assert(readFileSync("apps/web/.next/BUILD_ID", "utf8").trim(), "PRODUCTION_BUILD_REQUIRED");
} else throw Error("EXPECTED_PACKAGE_OR_RESTORE");
