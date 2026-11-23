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

const apiResponse = (result) => Response.json({ success: true, result });
const versionResponse = () =>
  apiResponse({ id: version, annotations: { "workers/tag": "web-" + source.sha } });
const apiFailure = (status, codes) =>
  Response.json(
    {
      success: false,
      errors: codes.map((code) => ({ code, message: "private provider details" })),
    },
    { status },
  );

async function deliveryFixture(t, { intercept, revalidate, pause } = {}) {
  const directory = await buildFixture(t);
  const requests = [];
  const waits = [];
  let manifest;
  return {
    waits,
    count: (method, suffix) =>
      requests.filter((request) => request.method === method && request.path.endsWith(suffix))
        .length,
    deliver: () =>
      deliverCloudflare({
        source,
        archiveHash: "b".repeat(64),
        token: "test",
        directory,
        revalidate: revalidate ?? (() => {}),
        pause: async (milliseconds) => {
          waits.push(milliseconds);
          await pause?.();
        },
        fetcher: async (address, options) => {
          const url = new URL(address);
          requests.push({ method: options.method ?? "GET", path: url.pathname });
          const overridden = await intercept?.(url.pathname, options);
          if (overridden !== undefined) return overridden;
          if (url.hostname === "app.fethiyetango.com")
            return new Response(url.pathname === entry ? javascript : html);
          if (url.pathname.endsWith("/settings"))
            return apiResponse({
              compatibility_date: "2026-11-17",
              compatibility_flags: [],
              bindings: [],
            });
          if (url.pathname.endsWith("/assets-upload-session")) {
            manifest = JSON.parse(options.body).manifest;
            return apiResponse({ jwt: "upload", buckets: [[manifest[entry].hash]] });
          }
          if (url.pathname.endsWith("/assets/upload")) return apiResponse({ jwt: "complete" });
          if (url.pathname.endsWith("/versions") && options.method === "POST")
            return apiResponse({ id: version });
          if (url.pathname.endsWith("/versions/" + version)) return versionResponse();
          assert(url.pathname.endsWith("/deployments"));
          return apiResponse(
            options.method === "POST"
              ? { id: deployment }
              : { deployments: [{ id: deployment, versions }] },
          );
        },
      }),
  };
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

test("waits for the exact uploaded version without repeating any write", async (t) => {
  let reads = 0;
  const fixture = await deliveryFixture(t, {
    intercept: (path) => {
      if (path.endsWith("/versions/" + version) && ++reads === 1) return apiFailure(404, [100146]);
    },
  });
  const receipt = await fixture.deliver();
  assert.equal(receipt.version, version);
  assert.equal(receipt.deployment, deployment);
  assert.equal(fixture.count("GET", "/versions/" + version), 2);
  assert.deepEqual(fixture.waits, [500]);
  assert.equal(fixture.count("POST", "/assets-upload-session"), 1);
  assert.equal(fixture.count("POST", "/assets/upload"), 1);
  assert.equal(fixture.count("POST", "/versions"), 1);
  assert.equal(fixture.count("POST", "/deployments"), 1);
});

test("fails after five unavailable-version reads and logs only numeric provider codes", async (t) => {
  const fixture = await deliveryFixture(t, {
    intercept: (path) => {
      if (path.endsWith("/versions/" + version)) return apiFailure(404, [100146]);
    },
  });
  await assert.rejects(fixture.deliver(), (error) => {
    assert.match(error.message, /HTTP 404/);
    assert.match(error.message, /100146/);
    assert(!error.message.includes("private provider details"));
    return true;
  });
  assert.equal(fixture.count("GET", "/versions/" + version), 5);
  assert.deepEqual(fixture.waits, [500, 500, 500, 500]);
  assert.equal(fixture.count("POST", "/versions"), 1);
  assert.equal(fixture.count("POST", "/deployments"), 0);
});

test("rejects other version read failures immediately", async (t) => {
  for (const [name, failure] of [
    ["another 404 code", () => apiFailure(404, [10007])],
    ["uncoded 404", () => apiFailure(404, [])],
    ["non-JSON 404", () => new Response("private provider details", { status: 404 })],
    [
      "malformed errors",
      () => Response.json({ success: false, errors: { code: 100146 } }, { status: 404 }),
    ],
    ["string code", () => apiFailure(404, ["100146"])],
    ["mixed codes", () => apiFailure(404, [100146, 10007])],
    ["mixed malformed codes", () => apiFailure(404, [100146, null])],
    ["forbidden", () => apiFailure(403, [100146])],
    ["server error", () => apiFailure(500, [100146])],
    [
      "network failure",
      () => {
        throw new Error("synthetic network failure");
      },
    ],
  ]) {
    await t.test(name, async (t) => {
      const fixture = await deliveryFixture(t, {
        intercept: (path) => {
          if (path.endsWith("/versions/" + version)) return failure();
        },
      });
      await assert.rejects(fixture.deliver(), (error) => {
        assert(!error.message.includes("private provider details"));
        return true;
      });
      assert.equal(fixture.count("GET", "/versions/" + version), 1);
      assert.deepEqual(fixture.waits, []);
      assert.equal(fixture.count("POST", "/deployments"), 0);
    });
  }
});

test("rejects a version with the wrong identity or source tag before promotion", async (t) => {
  for (const [name, result, expected] of [
    [
      "wrong version",
      { id: deployment, annotations: { "workers/tag": "web-" + source.sha } },
      /different version/,
    ],
    [
      "wrong source",
      { id: version, annotations: { "workers/tag": "web-wrong" } },
      /bound to the source/,
    ],
  ]) {
    await t.test(name, async (t) => {
      const fixture = await deliveryFixture(t, {
        intercept: (path) => {
          if (path.endsWith("/versions/" + version)) return apiResponse(result);
        },
      });
      await assert.rejects(fixture.deliver(), expected);
      assert.equal(fixture.count("GET", "/versions/" + version), 1);
      assert.deepEqual(fixture.waits, []);
      assert.equal(fixture.count("POST", "/deployments"), 0);
    });
  }
});

test("does not retry a write even when Cloudflare reports version-not-found", async (t) => {
  for (const suffix of ["/assets/upload", "/versions", "/deployments"]) {
    await t.test(suffix, async (t) => {
      const fixture = await deliveryFixture(t, {
        intercept: (path, options) => {
          if (options.method === "POST" && path.endsWith(suffix)) return apiFailure(404, [100146]);
        },
      });
      await assert.rejects(fixture.deliver(), /HTTP 404/);
      assert.equal(fixture.count("POST", suffix), 1);
      assert.deepEqual(fixture.waits, []);
      if (suffix !== "/deployments") assert.equal(fixture.count("POST", "/deployments"), 0);
    });
  }
});

test("revalidates source before promotion when main moves while the version becomes visible", async (t) => {
  let reads = 0;
  let moved = false;
  const fixture = await deliveryFixture(t, {
    intercept: (path) => {
      if (path.endsWith("/versions/" + version) && ++reads === 1) return apiFailure(404, [100146]);
    },
    pause: () => {
      moved = true;
    },
    revalidate: () => {
      if (moved) throw new Error("Accepted Cloudflare source is no longer current main");
    },
  });
  await assert.rejects(fixture.deliver(), /no longer current main/);
  assert.equal(fixture.count("GET", "/versions/" + version), 2);
  assert.deepEqual(fixture.waits, [500]);
  assert.equal(fixture.count("POST", "/versions"), 1);
  assert.equal(fixture.count("POST", "/deployments"), 0);
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
