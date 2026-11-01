import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const workflows = {
  frontend: {
    file: "frontend.yml",
    jobs: [
      "scope",
      "checks",
      ...["chromium", "firefox", "webkit", "mobile"].map((b) => `browsers (${b})`),
    ],
  },
};
const artifactName = (kind, attempt) => `frontend-source-${kind}-${attempt}`;
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

export function recordSource(kind, env = process.env) {
  if (!workflows[kind] || env.GITHUB_EVENT_NAME !== "pull_request")
    throw Error("PR_SOURCE_REQUIRED");
  const pr = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")).pull_request;
  const merge = env.GITHUB_SHA;
  const parents = git("show", "-s", "--format=%P", merge).split(" ");
  if (
    git("rev-parse", "HEAD") !== merge ||
    parents.length !== 2 ||
    parents[0] !== pr.base.sha ||
    parents[1] !== pr.head.sha
  )
    throw Error("CANDIDATE_SOURCE_MISMATCH");
  const binding = {
    version: 1,
    kind,
    repository: env.GITHUB_REPOSITORY,
    pr: pr.number,
    base: pr.base.sha,
    head: pr.head.sha,
    merge,
    tree: git("rev-parse", `${merge}^{tree}`),
    run: Number(env.GITHUB_RUN_ID),
    source_attempt: Number(env.GITHUB_RUN_ATTEMPT),
  };
  mkdirSync(".artifacts/ci", { recursive: true });
  writeFileSync(".artifacts/ci/frontend-source.json", JSON.stringify(binding));
  return binding;
}

export function validateProof(binding, { kind, repository, pr, commit, candidate, run, jobs }) {
  const spec = workflows[kind];
  if (
    !spec ||
    binding.version !== 1 ||
    binding.kind !== kind ||
    binding.repository !== repository ||
    binding.pr !== pr.number ||
    binding.base !== pr.base.sha ||
    binding.head !== pr.head.sha ||
    binding.run !== run.id ||
    !Number.isSafeInteger(binding.source_attempt) ||
    binding.source_attempt < 1 ||
    binding.source_attempt > run.run_attempt ||
    binding.tree !== commit.tree.sha ||
    candidate.sha !== binding.merge ||
    candidate.tree.sha !== commit.tree.sha
  )
    throw Error("CANDIDATE_BINDING_MISMATCH");
  for (const c of [commit, candidate]) {
    if (
      c.parents.length !== 2 ||
      c.parents[0].sha !== binding.base ||
      c.parents[1].sha !== binding.head
    )
      throw Error("MERGE_PARENTS_MISMATCH");
  }
  if (
    run.repository?.full_name !== repository ||
    run.event !== "pull_request" ||
    run.path !== `.github/workflows/${spec.file}` ||
    run.head_sha !== binding.head ||
    run.head_repository?.full_name !== pr.head.repo.full_name ||
    run.status !== "completed" ||
    run.conclusion !== "success"
  )
    throw Error("CANDIDATE_RUN_NOT_SUCCESSFUL");
  if (
    jobs.length !== spec.jobs.length ||
    spec.jobs.some((name) => {
      const matches = jobs.filter((job) => job.name === name);
      return (
        matches.length !== 1 ||
        matches[0].run_id !== run.id ||
        matches[0].run_attempt !== run.run_attempt ||
        matches[0].head_sha !== binding.head ||
        matches[0].status !== "completed" ||
        matches[0].conclusion !== "success" ||
        !matches[0].steps?.length ||
        matches[0].steps.some((step) => step.conclusion !== "success") ||
        requiredSteps(name).some(
          (step) =>
            matches[0].steps.filter((s) => s.name === step && s.conclusion === "success").length !==
            1,
        )
      );
    })
  )
    throw Error("REQUIRED_CANDIDATE_JOBS_NOT_SUCCESSFUL");
}

function requiredSteps(name) {
  if (name === "scope")
    return ["Select frontend scope", "Record candidate source", "Upload candidate source"];
  if (name === "checks")
    return [
      "Run pnpm check:frontend",
      "Run pnpm --filter @ftksaas/web test:isolation",
      "Run pnpm test:frontend:coverage",
    ];
  return ["Install selected browser", "Test selected browser"];
}

export function readBinding(archive) {
  const dir = mkdtempSync(join(tmpdir(), "frontend-proof-"));
  try {
    const path = join(dir, "source.zip");
    writeFileSync(path, archive);
    return JSON.parse(
      execFileSync("unzip", ["-p", path, "frontend-source.json"], { maxBuffer: 16384 }).toString(
        "utf8",
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Main executes only this verifier, never candidate code or artifact executables.
export async function verifyMain({ github, context, kind }) {
  const spec = workflows[kind];
  if (
    !spec ||
    context.eventName !== "push" ||
    context.payload.ref !== "refs/heads/main" ||
    context.payload.after !== context.sha
  )
    throw Error("MAIN_PUSH_REQUIRED");
  const repo = context.repo;
  const repository = `${repo.owner}/${repo.repo}`;
  const commit = (await github.rest.git.getCommit({ ...repo, commit_sha: context.sha })).data;
  if (commit.parents.length !== 2 || commit.parents[0].sha !== context.payload.before)
    throw Error("SINGLE_MERGE_PUSH_REQUIRED");
  const prs = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
    ...repo,
    commit_sha: context.sha,
    per_page: 100,
  });
  const matching = prs.filter(
    (p) =>
      p.merged_at &&
      p.merge_commit_sha === context.sha &&
      p.base.ref === "main" &&
      p.base.repo.full_name === repository,
  );
  if (matching.length !== 1) throw Error("MERGED_PR_REQUIRED");
  const pr = (await github.rest.pulls.get({ ...repo, pull_number: matching[0].number })).data;
  if (!pr.merged || pr.merge_commit_sha !== context.sha) throw Error("MERGED_PR_CHANGED");
  const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
    ...repo,
    workflow_id: spec.file,
    event: "pull_request",
    head_sha: pr.head.sha,
    per_page: 100,
  });
  for (const run of runs) {
    if (run.status !== "completed" || run.conclusion !== "success") continue;
    try {
      const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
        ...repo,
        run_id: run.id,
        attempt_number: run.run_attempt,
        per_page: 100,
      });
      // Failed-job reruns may retain the original scope artifact; bind it to that
      // actual source attempt, while validating all jobs in the current attempt.
      const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
        ...repo,
        run_id: run.id,
        per_page: 100,
      });
      const scopeJobs = jobs.filter((job) => job.name === "scope");
      if (scopeJobs.length !== 1) throw Error("SOURCE_JOB_REQUIRED");
      const uploads =
        scopeJobs[0].steps?.filter(
          (step) => step.name === "Upload candidate source" && step.conclusion === "success",
        ) ?? [];
      if (uploads.length !== 1) throw Error("SOURCE_UPLOAD_REQUIRED");
      const upload = uploads[0];
      // Runtime test jobs also have an artifact upload capability. Accept only
      // artifacts created during the isolated scope upload, before test jobs
      // start; a competing receipt from test execution cannot supply provenance.
      for (const artifact of artifacts.filter(
        (a) =>
          !a.expired &&
          Date.parse(a.created_at) >= Date.parse(upload.started_at) &&
          Date.parse(a.created_at) <= Date.parse(upload.completed_at) &&
          a.name.startsWith(`frontend-source-${kind}-`) &&
          a.size_in_bytes < 65536,
      )) {
        const download = await github.rest.actions.downloadArtifact({
          ...repo,
          artifact_id: artifact.id,
          archive_format: "zip",
        });
        const binding = readBinding(Buffer.from(download.data));
        if (artifact.name !== artifactName(kind, binding.source_attempt)) continue;
        const candidate = (await github.rest.git.getCommit({ ...repo, commit_sha: binding.merge }))
          .data;
        validateProof(binding, { kind, repository, pr, commit, candidate, run, jobs });
        const live = (await github.rest.actions.getWorkflowRun({ ...repo, run_id: run.id })).data;
        if (
          live.run_attempt !== run.run_attempt ||
          live.status !== "completed" ||
          live.conclusion !== "success"
        )
          throw Error("CANDIDATE_ATTEMPT_CHANGED");
        return {
          pr: pr.number,
          head: binding.head,
          base: binding.base,
          merge: binding.merge,
          tree: binding.tree,
          run: run.id,
          attempt: run.run_attempt,
          source_attempt: binding.source_attempt,
        };
      }
    } catch (error) {
      console.warn(`Candidate ${run.id} rejected: ${error.message}`);
    }
  }
  throw Error("NO_EXACT_SOURCE_FRONTEND_PROOF");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) recordSource(process.argv[2]);
