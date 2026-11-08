// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, expect, test } from "vitest";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function install(mode: string, digestOverride?: string) {
  const root = mkdtempSync(join(tmpdir(), "ftk-workflow-install-"));
  roots.push(root);
  const bin = join(root, "bin"),
    destination = join(root, "installed");
  mkdirSync(bin);
  mkdirSync(destination);
  writeFileSync(join(root, "tool"), "#!/bin/sh\necho verified-tool\n", { mode: 0o755 });
  const archive = join(root, "tool.tar.gz");
  execFileSync("tar", ["-czf", archive, "-C", root, "tool"]);
  const digest = digestOverride ?? createHash("sha256").update(readFileSync(archive)).digest("hex");
  writeFileSync(
    join(bin, "curl"),
    `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2), url = args.find(a => a.startsWith("https://"));
const output = args[args.indexOf("-o") + 1];
fs.appendFileSync(process.env.DOWNLOAD_LOG, JSON.stringify(args) + "\\n");
if (process.env.DOWNLOAD_MODE === "unavailable") process.exit(28);
if (url.startsWith("https://github.com/")) {
  if (["fallback", "hostile"].includes(process.env.DOWNLOAD_MODE)) process.exit(28);
  fs.copyFileSync(process.env.DOWNLOAD_ARCHIVE, output);
} else if (url.includes("/releases/tags/")) {
  fs.writeFileSync(output, JSON.stringify({ assets: [{ name: "tool.tar.gz", url:
    process.env.DOWNLOAD_MODE === "hostile" ? "https://example.invalid/asset" :
    "https://api.github.com/repos/vendor/tool/releases/assets/123" }] }));
} else if (url === "https://api.github.com/repos/vendor/tool/releases/assets/123") {
  fs.copyFileSync(process.env.DOWNLOAD_ARCHIVE, output);
} else process.exit(22);
`,
    { mode: 0o755 },
  );
  const log = join(root, "requests.jsonl");
  const result = spawnSync(
    "bash",
    [
      "-c",
      'source "$1"; destination="$2"; install_tool tool "$3" "$4"',
      "fixture",
      resolve("scripts/workflow-validation/install-tools.sh"),
      destination,
      "https://github.com/vendor/tool/releases/download/v1.0.0/tool.tar.gz",
      digest,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GH_TOKEN: "",
        PATH: `${bin}:${process.env.PATH}`,
        DOWNLOAD_MODE: mode,
        DOWNLOAD_ARCHIVE: archive,
        DOWNLOAD_LOG: log,
      },
    },
  );
  return {
    result,
    destination,
    requests: existsSync(log)
      ? readFileSync(log, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as string[])
      : [],
  };
}
test("verified primary download installs without contacting the alternative", () => {
  const { result, destination, requests } = install("primary");
  expect(result.status).toBe(0);
  expect(execFileSync(join(destination, "tool"), { encoding: "utf8" }).trim()).toBe(
    "verified-tool",
  );
  expect(requests).toHaveLength(1);
});
test("primary timeout uses official release metadata and binary asset with bounded calls", () => {
  const { result, destination, requests } = install("fallback");
  expect(result.status).toBe(0);
  expect(existsSync(join(destination, "tool"))).toBe(true);
  expect(requests.map((args) => args.find((arg) => arg.startsWith("https://")))).toEqual([
    "https://github.com/vendor/tool/releases/download/v1.0.0/tool.tar.gz",
    "https://api.github.com/repos/vendor/tool/releases/tags/v1.0.0",
    "https://api.github.com/repos/vendor/tool/releases/assets/123",
  ]);
  expect(requests.map((args) => Number(args[args.indexOf("--max-time") + 1]))).toEqual([
    20, 10, 30,
  ]);
  expect(requests[2]).toContain("Accept: application/octet-stream");
});
test("checksum mismatch cannot be hidden by an alternative download", () => {
  const { result, destination, requests } = install("primary", "0".repeat(64));
  expect(result.status).not.toBe(0);
  expect(existsSync(join(destination, "tool"))).toBe(false);
  expect(requests).toHaveLength(1);
});
test("unavailable official endpoints fail without installing a tool", () => {
  const { result, destination } = install("unavailable");
  expect(result.status).not.toBe(0);
  expect(existsSync(join(destination, "tool"))).toBe(false);
});
test("release metadata cannot redirect the downloader to another host", () => {
  const { result, destination, requests } = install("hostile");
  expect(result.status).not.toBe(0);
  expect(existsSync(join(destination, "tool"))).toBe(false);
  expect(requests).toHaveLength(2);
});
