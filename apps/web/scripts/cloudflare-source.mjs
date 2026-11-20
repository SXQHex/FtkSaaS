import { execFileSync } from "node:child_process";

const repository = "SXQHex/FtkSaaS";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

export function productionInput(path) {
  return (
    /^(?:apps\/web\/(?:src\/|public\/|index\.html$|vite\.config\.ts$|package\.json$|tsconfig[^/]*\.json$|turbo\.json$)|packages\/(?:ui|api-contracts|typescript-config)\/)/.test(
      path,
    ) ||
    [
      ".nvmrc",
      ".github/workflows/cd-cloudflare.yml",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "turbo.json",
    ].includes(path)
  );
}

export async function verifyCloudflareSource(github, repo, { sha, run, attempt }) {
  if (
    `${repo.owner}/${repo.repo}` !== repository ||
    !/^[a-f0-9]{40}$/.test(sha ?? "") ||
    !Number.isSafeInteger(run) ||
    run < 1 ||
    !Number.isSafeInteger(attempt) ||
    attempt < 1
  )
    throw Error("Invalid Cloudflare source binding");

  const { data: proof } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: run });
  if (
    proof.id !== run ||
    proof.run_attempt !== attempt ||
    proof.path !== ".github/workflows/backend.yml" ||
    proof.event !== "push" ||
    proof.head_branch !== "main" ||
    proof.head_sha !== sha ||
    proof.status !== "completed" ||
    proof.conclusion !== "success" ||
    proof.repository?.full_name !== repository ||
    proof.head_repository?.full_name !== repository
  )
    throw Error("Cloudflare delivery requires successful current-attempt main acceptance");

  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
    ...repo,
    run_id: run,
    attempt_number: attempt,
  });
  const source = jobs.filter((job) => job.name === "source");
  if (
    source.length !== 1 ||
    source[0].run_id !== run ||
    source[0].run_attempt !== attempt ||
    source[0].head_sha !== sha ||
    source[0].status !== "completed" ||
    source[0].conclusion !== "success" ||
    source[0].steps?.filter(
      (step) => step.name === "Verify merged candidate relation" && step.conclusion === "success",
    ).length !== 1
  )
    throw Error("Cloudflare delivery requires exact merged candidate proof");

  const { data: main } = await github.rest.git.getRef({ ...repo, ref: "heads/main" });
  if (main.object.sha !== sha) throw Error("Accepted Cloudflare source is no longer current main");
  const { data: current } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: run });
  if (
    current.run_attempt !== attempt ||
    current.status !== "completed" ||
    current.conclusion !== "success"
  )
    throw Error("Cloudflare acceptance attempt moved during verification");
}

export async function lastCloudflareDeployment(github, context) {
  const workflow = "cd-cloudflare.yml";
  const runs = github.paginate.iterator(github.rest.actions.listWorkflowRuns, {
    ...context.repo,
    workflow_id: workflow,
    status: "success",
    branch: "main",
    per_page: 100,
  });
  for await (const page of runs) {
    for (const run of page.data) {
      if (
        run.id === context.runId ||
        run.path !== ".github/workflows/" + workflow ||
        !["workflow_run", "workflow_dispatch"].includes(run.event) ||
        run.head_branch !== "main" ||
        run.status !== "completed" ||
        run.conclusion !== "success" ||
        !/^[a-f0-9]{40}$/.test(run.head_sha ?? "") ||
        run.head_repository?.full_name !== repository ||
        run.repository?.full_name !== repository
      )
        continue;
      const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
        ...context.repo,
        run_id: run.id,
        attempt_number: run.run_attempt,
      });
      if (
        jobs.some(
          (job) =>
            job.name === "deploy" &&
            job.run_id === run.id &&
            job.run_attempt === run.run_attempt &&
            job.head_sha === run.head_sha &&
            job.status === "completed" &&
            job.conclusion === "success" &&
            job.steps?.some(
              (step) =>
                step.name === "Deploy exact version and verify the static SPA" &&
                step.conclusion === "success",
            ),
        )
      )
        return run.head_sha;
    }
  }
  return null;
}

export async function selectCloudflareSource(github, context) {
  const manual = context.eventName === "workflow_dispatch";
  if (context.ref !== "refs/heads/main" || (!manual && context.eventName !== "workflow_run"))
    throw Error("Cloudflare delivery runs from main only");
  const event = context.payload.workflow_run;
  if (!manual && (event?.event !== "push" || event.conclusion !== "success")) return null;
  const sha = context.sha;
  let proof = event;
  if (manual) {
    const requested = Number(context.payload.inputs?.acceptance_run_id);
    if (!Number.isSafeInteger(requested) || requested < 1)
      throw Error("Invalid main acceptance run ID");
    proof = (await github.rest.actions.getWorkflowRun({ ...context.repo, run_id: requested })).data;
    if (proof.id !== requested) throw Error("Wrong Cloudflare acceptance run ID");
  } else if (event.head_sha !== sha) {
    // An older workflow completion can take the concurrency slot after a newer
    // merge. Use it only to wake delivery for the accepted commit checked out here.
    const { data } = await github.rest.actions.listWorkflowRuns({
      ...context.repo,
      workflow_id: "backend.yml",
      head_sha: sha,
      branch: "main",
      event: "push",
      status: "success",
    });
    proof = data.workflow_runs[0];
    if (!proof) return null;
  }
  const source = { sha, run: proof.id, attempt: proof.run_attempt };
  await verifyCloudflareSource(github, context.repo, source);
  const parents = git("show", "-s", "--format=%P", sha).split(" ");
  if (git("rev-parse", "HEAD") !== sha || parents.length !== 2)
    throw Error("Cloudflare checkout must match the accepted merge commit");
  if (manual) return source;
  const previous = await lastCloudflareDeployment(github, context);
  if (!previous) return source;
  git("merge-base", "--is-ancestor", previous, sha);
  const paths = git("diff", "--name-only", "--no-renames", "-z", previous, sha).split("\0");
  return paths.some(productionInput) ? source : null;
}
