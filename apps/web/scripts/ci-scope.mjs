import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const documentRegistry = "apps/backend/scripts/ci/document-paths.json";
const selector = "apps/web/scripts/ci-scope.mjs";
const selectorTests = "apps/web/tests/ci-scope.test.ts";
const sharedPolicy = [documentRegistry, selector, selectorTests];
const selectionPaths = {
  frontend: [
    "apps/web/**",
    "packages/ui/**",
    "vercel.json",
    ".github/workflows/frontend.yml",
    documentRegistry,
  ],
  compatibility: [
    "packages/api-contracts/**",
    "packages/typescript-config/**",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "turbo.json",
    ".nvmrc",
    ".github/workflows/frontend-compatibility.yml",
    ...sharedPolicy,
  ],
};

function selected(path, patterns) {
  return patterns.some((pattern) =>
    pattern.endsWith("/**") ? path.startsWith(pattern.slice(0, -2)) : path === pattern,
  );
}

export function selectScope(base, head, cwd = process.cwd()) {
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  for (const sha of [base, head]) {
    if (!/^[a-f0-9]{40}$/.test(sha ?? "") || /^0+$/.test(sha)) throw Error("EXACT_SOURCE_REQUIRED");
    git("cat-file", "-e", `${sha}^{commit}`);
  }
  // No GitHub changed-file pagination or event path-filter limit, and no rename
  // collapsing: deletion and destination must both take part in selection.
  const fields = new TextDecoder("utf-8", { fatal: true })
    .decode(git("diff", "--raw", "-z", "--no-renames", "--no-abbrev", base, head))
    .split("\0");
  if (fields.pop() !== "") throw Error("INCOMPLETE_SOURCE_DIFF");
  if (fields.length % 2 !== 0) throw Error("INVALID_SOURCE_DIFF");
  const result = { frontend: false, compatibility: false, paths: [] };
  if (!fields.length) return { ...result, frontend: true, compatibility: true };
  const documents = new Set(
    JSON.parse(git("show", `${head}:${documentRegistry}`).toString("utf8")),
  );
  for (let i = 0; i < fields.length; i += 2) {
    const metadata = /^:(\d{6}) (\d{6}) [a-f0-9]{40} [a-f0-9]{40} ([AMDT])$/.exec(fields[i]);
    if (!metadata) throw Error("UNKNOWN_SOURCE_CHANGE");
    const path = fields[i + 1];
    const policy = sharedPolicy.includes(path);
    let document = documents.has(path) && !policy;
    if (document) {
      for (const [sha, mode] of [
        [base, metadata[1]],
        [head, metadata[2]],
      ]) {
        if (mode === "000000") continue;
        if (mode !== "100644") {
          document = false;
          break;
        }
        const bytes = git("show", `${sha}:${path}`);
        try {
          new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          document = false;
          break;
        }
        if (bytes.includes(0)) {
          document = false;
          break;
        }
      }
    }
    const frontend = !document && (policy || selected(path, selectionPaths.frontend));
    const compatibility = !document && selected(path, selectionPaths.compatibility);
    result.frontend ||= frontend;
    result.compatibility ||= compatibility;
    result.paths.push({ path, document, frontend, compatibility });
  }
  return result;
}

export function eventScope(event, payload, sha, cwd = process.cwd()) {
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  if (!/^[a-f0-9]{40}$/.test(sha ?? "") || git("rev-parse", "HEAD") !== sha)
    throw Error("CHECKOUT_SOURCE_MISMATCH");
  if (event === "workflow_dispatch") return { frontend: true, compatibility: true, paths: [] };
  let base;
  if (event === "pull_request") {
    base = payload.pull_request?.base?.sha;
    const parents = git("show", "-s", "--format=%P", sha).split(" ");
    if (
      parents.length !== 2 ||
      parents[0] !== base ||
      parents[1] !== payload.pull_request?.head?.sha
    ) {
      throw Error("PR_MERGE_SOURCE_MISMATCH");
    }
  } else if (event === "push") {
    if (payload.ref !== "refs/heads/main" || payload.after !== sha)
      throw Error("PUSH_SOURCE_MISMATCH");
    base = payload.before;
  } else throw Error("UNSUPPORTED_SOURCE_EVENT");
  return selectScope(base, sha, cwd);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { readFileSync } = await import("node:fs");
  const scope = eventScope(
    process.env.GITHUB_EVENT_NAME,
    JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")),
    process.env.GITHUB_SHA,
  );
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `frontend=${scope.frontend}\ncompatibility=${scope.compatibility}\n`,
  );
  const summary = `Frontend scope (selection only; skipped jobs are not test acceptance):\n\n\`\`\`json\n${JSON.stringify(scope, null, 2)}\n\`\`\`\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
