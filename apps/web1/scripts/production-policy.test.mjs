import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { verifiedNoop } from "./production-policy.mjs";
const root = new URL("../node_modules/@tanstack/devtools-event-client/", import.meta.url);
for (const file of ["noop.js", "index.js"]) {
  test(`permits the reviewed official 0.5.1 ${file} only`, () => {
    const bytes = readFileSync(new URL(`dist/esm/${file}`, root));
    assert.equal(verifiedNoop(file, "0.5.1", bytes), true);
    assert.equal(verifiedNoop(file, "0.5.2", bytes), false);
    assert.equal(
      verifiedNoop(
        file,
        "0.5.1",
        Buffer.concat([bytes, Buffer.from(";dispatchEvent(new Event('x'))")]),
      ),
      false,
    );
    assert.equal(verifiedNoop("plugin.js", "0.5.1", bytes), false);
  });
}
test("rejects the active implementation even at the approved version", () => {
  assert.equal(
    verifiedNoop("plugin.js", "0.5.1", readFileSync(new URL("dist/esm/plugin.js", root))),
    false,
  );
});
