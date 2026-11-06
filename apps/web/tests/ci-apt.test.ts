// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { parse } from "yaml";
import { configureApt } from "../scripts/ci-apt.mjs";
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ftk-ci-apt-"));
  roots.push(root);
  mkdirSync(join(root, "sources.list.d"));
  mkdirSync(join(root, "apt.conf.d"));
  return root;
}
test("Ubuntu deb822 mirror lists are replaced with direct HTTPS while signed sources stay intact", () => {
  const root = fixture(),
    path = join(root, "sources.list.d/ubuntu.sources");
  writeFileSync(
    path,
    "Types: deb\nURIs: mirror+file:/etc/apt/apt-mirrors.txt\nSuites: noble noble-updates noble-security\nComponents: main universe\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n",
  );
  const vendor = join(root, "sources.list.d/microsoft-prod.list"),
    vendorSource =
      "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/ubuntu/24.04/prod noble main\n";
  writeFileSync(vendor, vendorSource);
  configureApt(root);
  const value = readFileSync(path, "utf8");
  expect(value).toContain("URIs: https://archive.ubuntu.com/ubuntu");
  expect(value).toContain("Suites: noble noble-updates noble-security");
  expect(value).toContain("Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg");
  expect(readFileSync(vendor, "utf8")).toBe(vendorSource);
  const policy = readFileSync(join(root, "apt.conf.d/99-ftksaas-network"), "utf8");
  expect(policy).toContain('Acquire::https::Timeout "30";');
  expect(policy).toContain('Acquire::Retries "2";');
  expect(policy).not.toMatch(/AllowUnauthenticated|Verify-Peer|trusted=yes/);
  configureApt(root);
  expect(readFileSync(path, "utf8")).toBe(value);
});
test("legacy Azure sources and official HTTP sources are normalized without touching components", () => {
  const root = fixture(),
    path = join(root, "sources.list");
  writeFileSync(
    path,
    "deb http://azure.archive.ubuntu.com/ubuntu/ noble main universe\ndeb http://security.ubuntu.com/ubuntu noble-security main\n",
  );
  configureApt(root);
  expect(readFileSync(path, "utf8")).toBe(
    "deb https://archive.ubuntu.com/ubuntu noble main universe\ndeb https://archive.ubuntu.com/ubuntu noble-security main\n",
  );
});
test("an unknown runner source layout fails visibly instead of claiming mirror repair", () => {
  const root = fixture();
  expect(() => configureApt(root)).toThrow("UBUNTU_APT_SOURCE_NOT_FOUND");
});
test("every browser uses repaired sources before the normal dependency installation", () => {
  const workflow = parse(
    readFileSync(new URL("../../../.github/workflows/frontend.yml", import.meta.url), "utf8"),
  );
  const job = workflow.jobs.browsers;
  expect(job.strategy.matrix.browser).toEqual(["chromium", "firefox", "webkit", "mobile"]);
  const prepare = job.steps.findIndex(
    (step: { name?: string }) => step.name === "Prepare Ubuntu package sources",
  );
  const install = job.steps.findIndex(
    (step: { name?: string }) => step.name === "Install selected browser",
  );
  expect(prepare).toBeGreaterThan(-1);
  expect(prepare).toBeLessThan(install);
  expect(job.steps[prepare].run).toContain(
    'sudo -- "$(command -v node)" apps/web/scripts/ci-apt.mjs',
  );
  expect(job.steps[install].run).toContain('playwright install --with-deps "$BROWSER"');
  expect(job.steps[install]["timeout-minutes"]).toBe(8);
});
