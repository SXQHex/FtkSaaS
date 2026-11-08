import assert from "node:assert/strict";
import { test } from "node:test";
import { deploymentSource } from "./live-source.mjs";

const sha = "a".repeat(40);
const deployment = {
  name: "ftksaas-web",
  url: "ftksaas-web-abc.vercel.app",
  readyState: "READY",
  target: "production",
  gitSource: { sha, repoId: "123" },
};
test("binds the exact ready production deployment to the requested source", () => {
  assert.equal(deploymentSource(deployment, sha, "123"), "https://ftksaas-web-abc.vercel.app");
});
for (const [name, change] of [
  ["different source", { gitSource: { ...deployment.gitSource, sha: "b".repeat(40) } }],
  ["another repository", { gitSource: { ...deployment.gitSource, repoId: "456" } }],
  ["another app", { name: "other-app" }],
  ["unfinished deployment", { readyState: "BUILDING" }],
  ["preview", { target: "preview" }],
  ["untrusted host", { url: "example.org" }],
  ["URL injection", { url: "ftksaas.vercel.app/path?secret=1" }],
]) {
  test(`rejects ${name}`, () =>
    assert.throws(() => deploymentSource({ ...deployment, ...change }, sha, "123")));
}
test("requires a full commit SHA", () =>
  assert.throws(() => deploymentSource(deployment, "main", "123")));
