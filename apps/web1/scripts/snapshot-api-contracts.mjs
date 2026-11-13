import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Read canonical generated artifacts; all writes stay inside this application.
const source = new URL("../../../packages/api-contracts/", import.meta.url);
const target = new URL("../src/lib/api-contracts/", import.meta.url);
const files = ["generated.ts", "operations.ts", "runtime.ts", "index.ts"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = process.argv.includes("--check");
const manifestUrl = new URL("manifest.json", target);
const manifest = check
  ? JSON.parse(readFileSync(manifestUrl, "utf8"))
  : {
      source: "packages/api-contracts/src",
      source_sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      schema_sha256: hash(readFileSync(new URL("schema/contract.json", source))),
      files: {},
    };
if (!check) mkdirSync(target, { recursive: true });
for (const name of files) {
  const bytes = readFileSync(new URL(`src/${name}`, source));
  // Generated type closure must remain local and cannot acquire server dependencies.
  for (const match of bytes.toString().matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    assert.ok(
      files.some((file) => match[1] === `./${file.replace(/\.ts$/, ".js")}`),
      `External import: ${name}`,
    );
  }
  if (check) {
    assert.equal(
      hash(readFileSync(new URL(name, target))),
      manifest.files[name],
      `Changed snapshot: ${name}`,
    );
    assert.equal(hash(bytes), manifest.files[name], `Canonical source changed: ${name}`);
  } else {
    writeFileSync(new URL(name, target), bytes);
    manifest.files[name] = hash(bytes);
  }
}
assert.equal(hash(readFileSync(new URL("schema/contract.json", source))), manifest.schema_sha256);
if (!check) writeFileSync(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${files.length} canonical contract files: local import closure and hashes verified`);
