import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { verifiedNoop } from "./production-policy.mjs";

const modules = JSON.parse(
  readFileSync(new URL("../.tmp/production-modules.json", import.meta.url), "utf8"),
);
assert.ok(Array.isArray(modules) && modules.length > 0, "Missing production module graph");
const noopRoot = new URL("../node_modules/@tanstack/devtools-event-client/", import.meta.url);
const noopVersion = JSON.parse(readFileSync(new URL("package.json", noopRoot), "utf8")).version;
const allowedNoopIds = ["noop.js", "index.js"].map((file) => {
  const url = new URL(`dist/esm/${file}`, noopRoot);
  assert.ok(verifiedNoop(file, noopVersion, readFileSync(url)), `Unreviewed no-op source: ${file}`);
  return fileURLToPath(url);
});
const forbidden = modules.filter(
  (id) =>
    /@tanstack\/[^/]*(?:devtools|event-bus)|src\/components\/devtools\.tsx/.test(id) &&
    !allowedNoopIds.includes(id),
);
assert.deepEqual(forbidden, [], "Devtools modules entered the production bundle");
assert.deepEqual(
  modules.filter((id) => /apps\/(?:backend|web)\/|packages\/|design-reference\//.test(id)),
  [],
  "Server, shared workspace, or reference modules entered the independent bundle",
);
const assets = new URL("../dist/assets/", import.meta.url);
const files = readdirSync(assets).filter((file) => file.endsWith(".js"));
assert.ok(files.length > 0, "No production JavaScript files");
for (const file of files) {
  assert.doesNotMatch(
    readFileSync(new URL(file, assets), "utf8"),
    /TanStackDevtools|ReactQueryDevtoolsPanel|TanStackRouterDevtoolsPanel|formDevtoolsPlugin|FormDevtoolsPanel|data-tsd-source|tanstack-devtools-global|tanstack-connect|__TANSTACK_EVENT_TARGET__|dispatchCustomEvent/,
  );
}
console.log(
  `Production: ${modules.length} module entries, ${files.length} JS chunks, zero active Devtools modules or UI/event-bus markers; reviewed 0.5.1 no-op only`,
);
