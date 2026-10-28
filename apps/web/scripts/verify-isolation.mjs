import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const manifest = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url)));
const turbo = fileURLToPath(new URL("../../../node_modules/turbo/bin/turbo", import.meta.url));
function graph(script) {
  const command = manifest.scripts[script];
  assert(command.startsWith("turbo run "), `${script} must use explicit Turbo tasks`);
  const result = execFileSync(
    process.execPath,
    [turbo, ...command.split(" ").slice(1), "--dry=json"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(result).tasks;
}
for (const script of [
  "test:frontend",
  "check:frontend",
  "test:frontend:e2e",
  "test:frontend:coverage",
]) {
  const tasks = graph(script);
  assert(
    tasks.some((task) => task.package === "@ftksaas/web"),
    `${script} omitted the web package`,
  );
  assert(
    !tasks.some((task) => task.package === "@ftksaas/backend"),
    `${script} selected backend work`,
  );
}
const backend = graph("test:backend");
assert(backend.some((task) => task.package === "@ftksaas/backend"));
assert(
  !backend.some((task) => ["@ftksaas/web", "@ftksaas/ui"].includes(task.package)),
  "Backend command selected frontend work",
);
console.log("Turbo task isolation verified; no backend tests executed.");
