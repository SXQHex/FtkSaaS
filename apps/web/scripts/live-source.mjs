import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function deploymentSource(deployment, expectedSha, repositoryId) {
  if (!/^[a-f0-9]{40}$/.test(expectedSha ?? "")) throw Error("A full deployed SHA is required.");
  if (
    deployment.readyState !== "READY" ||
    deployment.target !== "production" ||
    deployment.name !== "ftksaas-web" ||
    (deployment.gitSource?.sha ?? deployment.meta?.githubCommitSha) !== expectedSha ||
    String(deployment.gitSource?.repoId) !== repositoryId ||
    !/^[a-z0-9-]+\.vercel\.app$/.test(deployment.url ?? "")
  )
    throw Error("Deployment is not the requested ready FtkSaaS production source.");
  return `https://${deployment.url}`;
}

async function main() {
  const host = process.env.LIVE_DEPLOYMENT_HOST;
  if (!/^[a-z0-9-]+\.vercel\.app$/.test(host ?? ""))
    throw Error("Use a Vercel deployment hostname.");
  if (!process.env.VERCEL_TOKEN) throw Error("Missing deployment read credential.");
  const endpoint = new URL(`https://api.vercel.com/v13/deployments/${host}`);
  if (process.env.LIVE_VERCEL_TEAM_ID)
    endpoint.searchParams.set("teamId", process.env.LIVE_VERCEL_TEAM_ID);
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw Error(`Deployment lookup failed (${response.status}).`);
  const deployment = await response.json();
  const deployedSha = process.env.LIVE_DEPLOYED_SHA;
  const baseURL = deploymentSource(deployment, deployedSha, process.env.GITHUB_REPOSITORY_ID);
  // Tests may be added after the last application deploy. Permit that only when
  // every runtime/build input is identical; retain both SHAs in the evidence.
  execFileSync("git", ["merge-base", "--is-ancestor", deployedSha, "HEAD"], { stdio: "pipe" });
  execFileSync(
    "git",
    [
      "diff",
      "--exit-code",
      deployedSha,
      "HEAD",
      "--",
      "apps/web/src",
      "apps/web/messages",
      "apps/web/public",
      "apps/web/package.json",
      "apps/web/next.config.*",
      "apps/web/tsconfig.json",
      "apps/web/postcss.config.*",
      "packages/ui",
      "packages/api-contracts",
      "packages/typescript-config",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "package.json",
      "turbo.json",
      ".nvmrc",
      "vercel.json",
    ],
    { stdio: "pipe" },
  );
  mkdirSync(".artifacts/frontend/live-batch", { recursive: true });
  writeFileSync(
    ".artifacts/frontend/live-batch/source.json",
    JSON.stringify(
      {
        deployedSha,
        testSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        deploymentId: deployment.id,
        baseURL,
        runId: process.env.GITHUB_RUN_ID,
        attempt: process.env.GITHUB_RUN_ATTEMPT,
      },
      null,
      2,
    ),
  );
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `base_url=${baseURL}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error(
      "Live source verification failed: check the production deployment, full SHA and runtime tree. No credentials recorded.",
    );
    process.exitCode = 1;
  });
}
