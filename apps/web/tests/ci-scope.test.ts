import { readFileSync } from "node:fs";
import { matchesGlob, resolve } from "node:path";
import { parse } from "yaml";
import { expect, test } from "vitest";
function workflow(name: string) {
  return parse(readFileSync(resolve(process.cwd(), "../../.github/workflows", name), "utf8"));
}
test("actual frontend workflow paths exclude backend and shared-only changes for PR and main", () => {
  const config = workflow("frontend.yml");
  for (const event of ["push", "pull_request"]) {
    const paths: string[] = config.on[event].paths;
    const selected = (path: string) => paths.some((pattern) => matchesGlob(path, pattern));
    for (const path of [
      "apps/web/src/app/page.tsx",
      "packages/ui/src/components/button.tsx",
      ".github/workflows/frontend.yml",
    ])
      expect(selected(path), path).toBe(true);
    for (const path of [
      "apps/backend/package.json",
      "apps/backend/supabase/migrations/change.sql",
      "apps/backend/tests/api-acceptance.test.mjs",
      ".github/workflows/backend.yml",
      "packages/api-contracts/src/generated.ts",
      "pnpm-lock.yaml",
      "package.json",
    ])
      expect(selected(path), path).toBe(false);
  }
  expect(config.on.workflow_dispatch).toBeNull();
  expect(config.permissions).toEqual({ contents: "read" });
  expect(config.concurrency.group).toMatch(/^frontend-/);
});
test("shared compatibility workflow performs type and graph checks without either application's test suite", () => {
  const config = workflow("frontend-compatibility.yml");
  const commands = config.jobs.compatibility.steps.flatMap((step: { run?: string }) =>
    step.run ? [step.run] : [],
  );
  expect(commands).toContain(
    "pnpm exec turbo run typecheck --filter=@ftksaas/web --filter=@ftksaas/ui",
  );
  expect(commands).toContain("pnpm --filter @ftksaas/web test:isolation");
  expect(
    commands.some((command: string) =>
      /(?:^|\s)(?:test:backend|test:clean|test:api|test:e2e|check:frontend|test:frontend)(?:$|\s)/.test(
        command,
      ),
    ),
  ).toBe(false);
  expect(config.on.push.paths).toContain("pnpm-lock.yaml");
  expect(config.on.pull_request.paths).toContain("packages/api-contracts/**");
});
