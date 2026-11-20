import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { setTimeout } from "node:timers/promises";

const account = "ff98b572190b81bb15df49867fb2b2a8";
const worker = "ftksaas-app";
const hostname = "app.fethiyetango.com";
const api = `https://api.cloudflare.com/client/v4/accounts/${account}`;
const script = `/workers/scripts/${worker}`;
const types = new Map(
  Object.entries({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
  }),
);
const hash = (content) => createHash("sha256").update(content).digest("hex");
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export async function readAssets(root) {
  const manifest = {};
  const files = new Map();
  const byHash = new Map();

  async function walk(directory, prefix) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      assert.match(entry.name, /^[a-zA-Z0-9_@][a-zA-Z0-9_.@-]*$/, "Invalid static asset name");
      const file = join(directory, entry.name);
      const path = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(file, path);
        continue;
      }
      assert(entry.isFile(), "Only regular files belong in the static build");
      const extension = extname(path);
      const type = types.get(extension);
      assert(type, `Unexpected static asset type: ${extension}`);
      const bytes = await readFile(file);
      // Cloudflare's direct upload includes the extension in the content key.
      const key = hash(bytes.toString("base64") + extension.slice(1)).slice(0, 32);
      manifest[path] = { hash: key, size: bytes.byteLength };
      files.set(path, bytes);
      byHash.set(key, { bytes, type });
    }
  }

  await walk(root, "");
  const index = files.get("/index.html");
  const entry = index
    ?.toString()
    .match(/<script type="module"[^>]* src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert(entry && files.has(entry), "Vite build entry is missing from the static archive");
  return { manifest, byHash, entry, indexHash: hash(index), entryHash: hash(files.get(entry)) };
}

export async function deliverCloudflare({
  source,
  archiveHash,
  token,
  directory,
  revalidate,
  fetcher = fetch,
  pause = setTimeout,
}) {
  assert(token, "Configure CLOUDFLARE_API_TOKEN in the cloudflare-production environment");
  const assets = await readAssets(directory);
  async function request(path, { body, authorization = token } = {}) {
    const response = await fetcher(api + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${authorization}`,
        ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      },
      body: body instanceof FormData ? body : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw Error(`Cloudflare API HTTP ${response.status}`);
    const result = await response.json();
    if (result.success !== true) throw Error("Cloudflare API rejected the request");
    return result.result;
  }
  const settings = await request(script + "/settings");
  assert(
    settings.compatibility_date === "2026-11-17" &&
      settings.bindings?.length === 0 &&
      settings.compatibility_flags?.length === 0,
    "Cloudflare Worker static settings drifted",
  );
  await revalidate();
  const session = await request(script + "/assets-upload-session", {
    body: { manifest: assets.manifest },
  });
  assert(
    typeof session.jwt === "string" && session.jwt && Array.isArray(session.buckets),
    "Cloudflare asset upload session is invalid",
  );
  let completion = session.buckets.length ? null : session.jwt;
  for (const bucket of session.buckets) {
    const form = new FormData();
    for (const key of bucket) {
      const asset = assets.byHash.get(key);
      assert(asset, "Cloudflare requested an unknown static asset");
      form.set(key, new Blob([asset.bytes.toString("base64")], { type: asset.type }), key);
    }
    const uploaded = await request("/workers/assets/upload?base64=true", {
      body: form,
      authorization: session.jwt,
    });
    if (uploaded?.jwt) completion = uploaded.jwt;
  }
  assert(completion, "Cloudflare did not complete the asset upload");

  const tag = `web-${source.sha}`;
  const form = new FormData();
  form.set(
    "metadata",
    JSON.stringify({
      compatibility_date: settings.compatibility_date,
      assets: { jwt: completion, config: { not_found_handling: "single-page-application" } },
      annotations: {
        "workers/tag": tag,
        "workers/commit_sha": source.sha,
        "workers/message": `SHA ${source.sha} · main acceptance ${source.run}/${source.attempt} · build ${archiveHash}`,
      },
    }),
  );
  await revalidate();
  const version = await request(script + "/versions", { body: form });
  assert.match(version.id ?? "", uuid, "Cloudflare version ID is missing");
  const confirmed = await request(script + "/versions/" + version.id);
  assert.equal(confirmed.id, version.id, "Cloudflare returned a different version");
  assert.equal(
    confirmed.annotations?.["workers/tag"],
    tag,
    "Cloudflare version was not bound to the source",
  );

  const releases = script + "/deployments";
  const versions = [{ version_id: version.id, percentage: 100 }];
  await revalidate();
  const deployment = await request(releases, { body: { strategy: "percentage", versions } });
  assert.match(deployment.id ?? "", uuid, "Cloudflare deployment ID is missing");
  const live = await request(releases);
  assert.equal(live.deployments?.[0]?.id, deployment.id, "Cloudflare deployment is not current");
  assert.deepEqual(
    live.deployments[0].versions,
    versions,
    "Cloudflare traffic did not move to the uploaded version",
  );

  const browserUrl = "https://" + hostname;
  let propagationAttempts = 0;
  while (propagationAttempts++ < 8) {
    const routes = await Promise.all(
      ["/", "/login", "/auth/callback", assets.entry].map((path) =>
        fetcher(browserUrl + path + "?release=" + version.id, {
          headers: { "Cache-Control": "no-cache", "Sec-Fetch-Mode": "navigate" },
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        }),
      ),
    );
    const digests = await Promise.all(
      routes.map(async (response) =>
        response.ok ? hash(Buffer.from(await response.arrayBuffer())) : null,
      ),
    );
    if (
      digests.slice(0, 3).every((digest) => digest === assets.indexHash) &&
      digests[3] === assets.entryHash
    )
      return {
        ...source,
        worker,
        deployment: deployment.id,
        version: version.id,
        archiveHash,
        url: browserUrl,
      };
    await pause(5000);
  }
  throw Error(
    `Cloudflare deployment ${deployment.id} is active but static SPA verification failed`,
  );
}
