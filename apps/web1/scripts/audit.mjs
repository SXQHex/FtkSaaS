import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const scope = process.argv[2];
if (scope !== "production" && scope !== "all")
  throw new Error("Audit scope must be production or all");
mkdirSync("test-reports", { recursive: true });
const args = ["audit", "--json", "--audit-level=low"];
if (scope === "production") args.push("--omit=dev");
const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
  encoding: "utf8",
  env: process.env,
});
if (result.error) throw result.error;
writeFileSync(`test-reports/audit-${scope}.json`, result.stdout);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
// Preserve audit findings and registry failures as failures, including low severity.
process.exitCode = result.status ?? 1;
