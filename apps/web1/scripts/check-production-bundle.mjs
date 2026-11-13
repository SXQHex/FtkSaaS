import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const modules = JSON.parse(
  readFileSync(new URL("../.tmp/production-modules.json", import.meta.url), "utf8"),
);
assert.ok(Array.isArray(modules) && modules.length > 0, "Missing production module graph");
const forbidden = modules.filter((id) =>
  /@tanstack\/[^/]*(?:devtools|event-bus)|src\/components\/devtools\.tsx/.test(id),
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
    /TanStackDevtools|ReactQueryDevtoolsPanel|TanStackRouterDevtoolsPanel|formDevtoolsPlugin|FormDevtoolsPanel|data-tsd-source/,
  );
}
console.log(
  `Production: ${modules.length} module entries, ${files.length} JS chunks, zero Devtools modules or UI markers`,
);
