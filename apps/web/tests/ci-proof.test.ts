import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { readBinding, validateProof, verifyMain } from "../scripts/ci-proof.mjs";

function fixture(kind = "frontend", attempt = 1) {
  const binding = {
    version: 1,
    kind,
    repository: "owner/repo",
    pr: 108,
    head: "h",
    base: "b",
    merge: "candidate",
    tree: "tree",
    run: 10,
    source_attempt: 1,
  };
  const commit = { sha: "main", tree: { sha: "tree" }, parents: [{ sha: "b" }, { sha: "h" }] };
  const pr = {
    number: 108,
    merged: true,
    merge_commit_sha: "main",
    base: { sha: "b", ref: "main", repo: { full_name: "owner/repo" } },
    head: { sha: "h", repo: { full_name: "owner/repo" } },
  };
  const run = {
    id: 10,
    repository: { full_name: "owner/repo" },
    event: "pull_request",
    path: `.github/workflows/${kind === "frontend" ? "frontend" : "frontend-compatibility"}.yml`,
    head_sha: "h",
    head_repository: { full_name: "owner/repo" },
    status: "completed",
    conclusion: "success",
    run_attempt: attempt,
  };
  const names: Record<string, string[]> = {
    scope: ["Select frontend scope", "Record candidate source", "Upload candidate source"],
    ...(kind === "frontend"
      ? {
          checks: [
            "Run pnpm check:frontend",
            "Run pnpm --filter @ftksaas/web test:isolation",
            "Run pnpm test:frontend:coverage",
          ],
          ...Object.fromEntries(
            ["chromium", "firefox", "webkit", "mobile"].map((b) => [
              `browsers (${b})`,
              ["Install selected browser", "Test selected browser"],
            ]),
          ),
        }
      : {
          compatibility: [
            "Run pnpm exec turbo run typecheck --filter=@ftksaas/web --filter=@ftksaas/ui",
            "Run pnpm --filter @ftksaas/web test:isolation",
          ],
        }),
  };
  const jobs = Object.entries(names).map(([name, steps]) => ({
    name,
    run_id: 10,
    run_attempt: attempt,
    head_sha: "h",
    status: "completed",
    conclusion: "success",
    steps: steps.map((name) => ({
      name,
      conclusion: "success",
      started_at: "2026-11-01T01:00:00Z",
      completed_at: "2026-11-01T01:00:02Z",
    })),
  }));
  return {
    binding,
    proof: {
      kind,
      repository: "owner/repo",
      pr,
      commit,
      candidate: { ...commit, sha: "candidate" },
      run,
      jobs,
    },
  };
}

test.each(["frontend"])(
  "%s accepts original success and retained jobs after failed-job rerun",
  (kind) => {
    for (const attempt of [1, 2, 3]) {
      const { binding, proof } = fixture(kind, attempt);
      expect(() => validateProof(binding, proof)).not.toThrow(Error);
    }
  },
);
test.each(["cancelled", "failure", "skipped", "timed_out"])(
  "rejects a required job still %s after rerun",
  (conclusion) => {
    const { binding, proof } = fixture("frontend", 2);
    proof.jobs[2].conclusion = conclusion;
    expect(() => validateProof(binding, proof)).toThrow("REQUIRED_CANDIDATE_JOBS");
  },
);
test.each(["base", "head", "tree", "run", "pr", "repository", "kind", "merge", "source_attempt"])(
  "rejects changed binding %s",
  (field) => {
    const { binding, proof } = fixture();
    expect(() => validateProof({ ...binding, [field]: "changed" }, proof)).toThrow(Error);
  },
);
test("rejects changed parents, missing/duplicate job, missing/failed step and historical attempt", () => {
  for (const mutate of [
    (p) => {
      p.commit.parents.reverse();
    },
    (p) => {
      p.jobs.pop();
    },
    (p) => {
      p.jobs.push(p.jobs[0]);
    },
    (p) => {
      p.jobs[1].steps.pop();
    },
    (p) => {
      p.jobs[1].steps[0].conclusion = "skipped";
    },
    (p) => {
      p.jobs[1].run_attempt = 1;
    },
    (p) => {
      p.run.conclusion = "cancelled";
    },
    (p) => {
      p.run.event = "workflow_dispatch";
    },
  ] satisfies ((p: ReturnType<typeof fixture>["proof"]) => void)[]) {
    const { binding, proof } = fixture("frontend", 2);
    mutate(proof);
    expect(() => validateProof(binding, proof)).toThrow(Error);
  }
});
function archive(binding: object) {
  const dir = mkdtempSync(join(tmpdir(), "frontend-proof-test-"));
  try {
    writeFileSync(join(dir, "frontend-source.json"), JSON.stringify(binding));
    execFileSync("zip", ["-q", "source.zip", "frontend-source.json"], { cwd: dir });
    return readFileSync(join(dir, "source.zip"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("reads bounded JSON from zip without extracting executable files", () => {
  expect(readBinding(archive({ version: 1 }))).toEqual({ version: 1 });
  expect(() => readBinding(archive({ value: "a".repeat(20000) }))).toThrow(Error);
});
test.each(["success", "attempt-race", "late-artifact", "old-then-current", "expired"])(
  "main verifies actual merge, artifact provenance and live attempt (%s)",
  async (scenario) => {
    const { binding, proof } = fixture("frontend", 2);
    const endpoints = {
      commit: "commit",
      prs: "prs",
      pr: "pr",
      runs: "runs",
      jobs: "jobs",
      artifacts: "artifacts",
      download: "download",
      live: "live",
    };
    const calls: number[] = [];
    const github = {
      rest: {
        git: {
          getCommit: async ({ commit_sha }: { commit_sha: string }) => ({
            data: commit_sha === "main" ? proof.commit : proof.candidate,
          }),
        },
        repos: { listPullRequestsAssociatedWithCommit: endpoints.prs },
        pulls: { get: async () => ({ data: proof.pr }) },
        actions: {
          listWorkflowRuns: endpoints.runs,
          listJobsForWorkflowRunAttempt: endpoints.jobs,
          listWorkflowRunArtifacts: endpoints.artifacts,
          downloadArtifact: async () => ({ data: archive(binding) }),
          getWorkflowRun: async () => ({
            data: { ...proof.run, run_attempt: scenario === "attempt-race" ? 3 : 2 },
          }),
        },
      },
      paginate: async (endpoint: string, params: { attempt_number?: number }) => {
        if (endpoint === endpoints.prs) return [{ ...proof.pr, merged_at: "now" }];
        if (endpoint === endpoints.runs) return [proof.run];
        if (endpoint === endpoints.jobs) {
          calls.push(params.attempt_number ?? 0);
          return proof.jobs;
        }
        if (endpoint === endpoints.artifacts) {
          const artifact = {
            id: 1,
            expired: scenario === "expired",
            name: "frontend-source-frontend-1",
            size_in_bytes: 1000,
            created_at:
              scenario === "late-artifact" ? "2026-11-01T01:00:03Z" : "2026-11-01T01:00:01Z",
          };
          return scenario === "old-then-current"
            ? [{ ...artifact, id: 0, created_at: "2026-11-01T00:59:00Z" }, artifact]
            : [artifact];
        }
        throw Error("Unexpected API");
      },
    };
    const result = verifyMain({
      github,
      kind: "frontend",
      context: {
        eventName: "push",
        sha: "main",
        repo: { owner: "owner", repo: "repo" },
        payload: { ref: "refs/heads/main", before: "b", after: "main" },
      },
    });
    const outcome = await result.then(
      (value) => ({ value, error: null }),
      (error: Error) => ({ value: null, error: error.message }),
    );
    expect(outcome).toEqual(
      ["attempt-race", "late-artifact", "expired"].includes(scenario)
        ? { value: null, error: "NO_EXACT_SOURCE_FRONTEND_PROOF" }
        : {
            value: {
              pr: 108,
              head: "h",
              base: "b",
              merge: "candidate",
              tree: "tree",
              run: 10,
              attempt: 2,
              source_attempt: 1,
            },
            error: null,
          },
    );
    expect(calls).toEqual([2]);
  },
);

test("candidate receipt records the event merge and rejects changed checkout", () => {
  const dir = mkdtempSync(join(tmpdir(), "frontend-source-test-"));
  const script = resolve("scripts/ci-proof.mjs");
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" }).trim();
  try {
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Fixture");
    git("config", "user.email", "fixture@example.invalid");
    git("commit", "-qm", "base", "--allow-empty");
    const base = git("rev-parse", "HEAD");
    git("checkout", "-qb", "topic");
    git("commit", "-qm", "head", "--allow-empty");
    const head = git("rev-parse", "HEAD");
    git("checkout", "main");
    git("merge", "--no-ff", "-m", "candidate", "topic");
    const merge = git("rev-parse", "HEAD");
    const event = join(dir, "event.json");
    writeFileSync(
      event,
      JSON.stringify({ pull_request: { number: 108, base: { sha: base }, head: { sha: head } } }),
    );
    const env = {
      ...process.env,
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: event,
      GITHUB_SHA: merge,
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_RUN_ID: "10",
      GITHUB_RUN_ATTEMPT: "1",
    };
    execFileSync(process.execPath, [script, "frontend"], { cwd: dir, env, stdio: "pipe" });
    expect(
      JSON.parse(readFileSync(join(dir, ".artifacts/ci/frontend-source.json"), "utf8")),
    ).toMatchObject({
      head,
      base,
      merge,
      run: 10,
      source_attempt: 1,
      tree: git("rev-parse", "HEAD^{tree}"),
    });
    git("checkout", "topic");
    expect(() =>
      execFileSync(process.execPath, [script, "frontend"], { cwd: dir, env, stdio: "pipe" }),
    ).toThrow("CANDIDATE_SOURCE_MISMATCH");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
