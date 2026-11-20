import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { deliverCloudflare, readAssets } from "./cloudflare-delivery.mjs";
import {
  lastCloudflareDeployment,
  productionInput,
  verifyCloudflareSource,
} from "./cloudflare-source.mjs";

const source = { sha: "a".repeat(40), run: 52, attempt: 2 };
const repo = { owner: "SXQHex", repo: "FtkSaaS" };

test("selects production application and shared sources, excluding tests and backend runtime", () => {
  for (const path of [
    "apps/web/index.html",
    "apps/web/src/main.tsx",
    "apps/web/public/favicon.svg",
    "apps/web/vite.config.ts",
    "packages/ui/src/components/button.tsx",
    "pnpm-lock.yaml",
  ])
    assert(productionInput(path), path);
  for (const path of [
    "apps/web/docs/todo.md",
    "apps/web/e2e/login.spec.ts",
    "apps/backend/package.json",
  ])
    assert(!productionInput(path), path);
});

test("binds Cloudflare delivery to successful current source proof", async () => {
  const proof = {
    id: source.run,
    run_attempt: source.attempt,
    event: "push",
    path: ".github/workflows/backend.yml",
    status: "completed",
    conclusion: "success",
    head_branch: "main",
    head_sha: source.sha,
    repository: { full_name: "SXQHex/FtkSaaS" },
    head_repository: { full_name: "SXQHex/FtkSaaS" },
  };
  const job = {
    name: "source",
    run_id: source.run,
    run_attempt: source.attempt,
    head_sha: source.sha,
    status: "completed",
    conclusion: "success",
    steps: [{ name: "Verify merged candidate relation", conclusion: "success" }],
  };
  let main = source.sha;
  const github = {
    rest: {
      actions: { getWorkflowRun: async () => ({ data: proof }) },
      git: {
        getRef: async () => ({ data: { object: { sha: main } } }),
      },
    },
    paginate: async () => [job],
  };
  await verifyCloudflareSource(github, repo, source);
  await assert.rejects(
    verifyCloudflareSource(github, repo, { ...source, attempt: 1 }),
    /current-attempt/,
  );
  proof.event = "pull_request";
  await assert.rejects(verifyCloudflareSource(github, repo, source), /main acceptance/);
  proof.event = "push";
  job.steps[0].conclusion = "skipped";
  await assert.rejects(verifyCloudflareSource(github, repo, source), /candidate proof/);
  job.steps[0].conclusion = "success";
  main = "b".repeat(40);
  await assert.rejects(verifyCloudflareSource(github, repo, source), /no longer current/);
});

test("uses the last promoted source when a newer main run skipped deployment", async () => {
  const prior = {
    id: 41,
    run_attempt: 2,
    event: "workflow_run",
    path: ".github/workflows/cd-cloudflare.yml",
    head_branch: "main",
    status: "completed",
    conclusion: "success",
    head_sha: "e".repeat(40),
    repository: { full_name: "SXQHex/FtkSaaS" },
    head_repository: { full_name: "SXQHex/FtkSaaS" },
  };
  const skipped = { ...prior, id: 42, head_sha: "f".repeat(40) };
  const deploymentJob = {
    name: "deploy",
    run_id: prior.id,
    run_attempt: prior.run_attempt,
    head_sha: prior.head_sha,
    status: "completed",
    conclusion: "success",
    steps: [{ name: "Deploy exact version and verify the static SPA", conclusion: "success" }],
  };
  const paginate = async (_method, { run_id }) => (run_id === prior.id ? [deploymentJob] : []);
  paginate.iterator = async function* () {
    yield { data: [skipped, prior] };
  };
  const github = { paginate, rest: { actions: {} } };
  assert.equal(await lastCloudflareDeployment(github, { repo, runId: 43 }), prior.head_sha);
  deploymentJob.steps[0].conclusion = "skipped";
  assert.equal(await lastCloudflareDeployment(github, { repo, runId: 43 }), null);
});

const entry = "/assets/index-abc.js";
const html = `<!doctype html><script type="module" crossorigin src="${entry}"></script>`;
const javascript = "const value = 'synthetic';";
const version = "11111111-1111-1111-1111-111111111111";
const deployment = "22222222-2222-2222-2222-222222222222";
const versions = [{ version_id: version, percentage: 100 }];

async function buildFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "ftk-cloudflare-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "assets"));
  await writeFile(join(directory, "index.html"), html);
  await writeFile(join(directory, "assets", "index-abc.js"), javascript);
  return directory;
}

test("uploads exact static bytes and promotes only the verified 100% deployment", async (t) => {
  const directory = await buildFixture(t);
  const urls = [];
  let validations = 0;
  let manifest;
  const response = (result) => Response.json({ success: true, result });
  const fetcher = async (address, options) => {
    const url = new URL(address);
    urls.push(url.pathname);
    if (url.hostname === "app.fethiyetango.com")
      return new Response(url.pathname === entry ? javascript : html);
    if (url.pathname.endsWith("/settings"))
      return response({ compatibility_date: "2026-11-17", compatibility_flags: [], bindings: [] });
    if (url.pathname.endsWith("/assets-upload-session")) {
      assert.equal(validations, 1);
      manifest = JSON.parse(options.body).manifest;
      return response({ jwt: "upload", buckets: [[manifest[entry].hash]] });
    }
    if (url.pathname.endsWith("/assets/upload")) {
      assert.equal(options.headers.Authorization, "Bearer upload");
      assert.equal(
        await options.body.get(manifest[entry].hash).text(),
        Buffer.from(javascript).toString("base64"),
      );
      return response({ jwt: "complete" });
    }
    if (url.pathname.endsWith("/versions")) {
      assert.equal(validations, 2);
      const metadata = JSON.parse(options.body.get("metadata"));
      assert.deepEqual(metadata.assets, {
        jwt: "complete",
        config: { not_found_handling: "single-page-application" },
      });
      assert.equal(metadata.annotations["workers/commit_sha"], source.sha);
      return response({ id: version });
    }
    if (url.pathname.endsWith("/versions/" + version))
      return response({ id: version, annotations: { "workers/tag": "web-" + source.sha } });
    if (url.pathname.endsWith("/deployments") && options.method === "POST") {
      assert.equal(validations, 3);
      assert.deepEqual(JSON.parse(options.body), { strategy: "percentage", versions });
      return response({ id: deployment });
    }
    assert(url.pathname.endsWith("/deployments"));
    return response({ deployments: [{ id: deployment, versions }] });
  };
  const receipt = await deliverCloudflare({
    source,
    archiveHash: "b".repeat(64),
    token: "test",
    directory,
    revalidate: () => {
      validations++;
    },
    fetcher,
  });
  assert.equal(receipt.version, version);
  assert.equal(receipt.deployment, deployment);
  assert.deepEqual(urls.slice(-4), ["/", "/login", "/auth/callback", entry]);
});

test("rejects an incomplete build or symlink before connecting to Cloudflare", async (t) => {
  const directory = await buildFixture(t);
  const cached = join(directory, "public.svg");
  await symlink(join(directory, "index.html"), cached);
  await assert.rejects(readAssets(directory), /Only regular files/);
  await rm(cached);
  await rm(join(directory, "assets", "index-abc.js"));
  await assert.rejects(readAssets(directory), /entry is missing/);
});
