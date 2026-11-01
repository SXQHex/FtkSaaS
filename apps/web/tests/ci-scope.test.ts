import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { expect, test } from "vitest";
import { eventScope, selectScope } from "../scripts/ci-scope.mjs";
function workflow(name: string) {
  return parse(readFileSync(resolve(process.cwd(), "../../.github/workflows", name), "utf8"));
}
test("frontend checks retain build, coverage, isolation and all four browsers", () => {
  const config = workflow("frontend.yml");
  expect(config.jobs.browsers.strategy.matrix.browser).toEqual([
    "chromium",
    "firefox",
    "webkit",
    "mobile",
  ]);
  const commands = config.jobs.checks.steps.map((step: { run?: string }) => step.run);
  expect(commands).toContain("pnpm check:frontend");
  expect(commands).toContain("pnpm test:frontend:coverage");
  expect(commands).toContain("pnpm --filter @ftksaas/web test:isolation");
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
});

test.each([
  ["frontend.yml", "frontend", ["checks", "browsers"]],
  ["frontend-compatibility.yml", "compatibility", ["compatibility"]],
] as const)(
  "%s gates existing jobs behind a dependency-free, source-bound selector",
  (file, output, jobs) => {
    const config = workflow(file);
    for (const event of ["pull_request"]) {
      expect(config.on[event].paths).toBeUndefined();
      expect(config.on[event]["paths-ignore"]).toBeUndefined();
      expect(config.on[event].branches).toEqual(["main"]);
    }
    expect(config.on.pull_request.types).toEqual(["opened", "synchronize", "reopened", "edited"]);
    expect(config.on.workflow_dispatch).toBeNull();
    expect(config.on.push).toBeUndefined();
    expect(config.concurrency.group).toContain(
      "github.event.changes.base == null && 'metadata' || 'source'",
    );
    expect(config.permissions).toEqual({});
    for (const job of Object.values(config.jobs) as { permissions: Record<string, string> }[]) {
      expect(job.permissions).toEqual({ contents: "read" });
    }
    const scope = config.jobs.scope;
    expect(scope.if).toBe("github.event.action != 'edited' || github.event.changes.base != null");
    expect(scope.outputs[output]).toBe(`\${{ steps.scope.outputs.${output} }}`);
    expect(scope.steps[0].with).toEqual({
      ref: "${{ github.sha }}",
      "fetch-depth": 0,
      "persist-credentials": false,
    });
    expect(scope.steps.flatMap((step: { run?: string }) => (step.run ? [step.run] : []))).toEqual([
      "node apps/web/scripts/ci-scope.mjs",
      ...(output === "frontend" ? ["node apps/web/scripts/ci-proof.mjs frontend"] : []),
    ]);
    for (const name of jobs) {
      expect(config.jobs[name].needs).toBe("scope");
      expect(config.jobs[name].if).toBe(`needs.scope.outputs.${output} == 'true'`);
    }
  },
);

const registry = "apps/backend/scripts/ci/document-paths.json";
const reviewed = [
  "apps/web/README.md",
  "apps/web/docs/todo.md",
  "packages/api-contracts/README.md",
];
function fixture(
  run: (repo: {
    dir: string;
    base: string;
    git: (...args: string[]) => string;
    write: (path: string, content: string | Uint8Array) => void;
    commit: () => string;
  }) => void,
) {
  const dir = mkdtempSync(join(tmpdir(), "frontend-scope-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const write = (path: string, content: string | Uint8Array) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  const commit = () => {
    git("add", "-A");
    git("commit", "-qm", "fixture");
    return git("rev-parse", "HEAD");
  };
  try {
    git("init", "-q", "-b", "main");
    git("config", "user.name", "CI scope fixture");
    git("config", "user.email", "fixture@example.invalid");
    git("config", "core.filemode", "true");
    write(registry, JSON.stringify(reviewed));
    for (const path of reviewed) write(path, "# Initial document\n");
    run({ dir, base: commit(), git, write, commit });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("reviewed frontend and shared prose skip heavy work; mixed cumulative code still runs", () =>
  fixture(({ dir, base, write, commit }) => {
    for (const path of reviewed) write(path, "# Güncel belge\n");
    let head = commit();
    expect(selectScope(base, head, dir)).toMatchObject({ frontend: false, compatibility: false });
    write("apps/web/src/example.ts", "export const version = 1;");
    commit();
    write("apps/web/docs/todo.md", "# Later prose commit\n");
    head = commit();
    expect(selectScope(base, head, dir)).toMatchObject({ frontend: true, compatibility: false });
    write("packages/api-contracts/schema/contract.json", "{}");
    expect(selectScope(base, commit(), dir)).toMatchObject({ frontend: true, compatibility: true });
  }));

test.each([
  ["apps/web/docs/new.md", true, false],
  ["packages/ui/src/button.tsx", true, false],
  ["vercel.json", true, false],
  [".github/workflows/frontend.yml", true, false],
  [".github/workflows/frontend-compatibility.yml", false, true],
  ["packages/api-contracts/schema/contract.json", false, true],
  ["packages/typescript-config/base.json", false, true],
  ...["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json", ".nvmrc"].map(
    (path) => [path, false, true] as const,
  ),
  ["apps/web/scripts/ci-scope.mjs", true, true],
  ["apps/web/tests/ci-scope.test.ts", true, true],
  ["apps/backend/database/example.sql", false, false],
] as const)("%s selects its required consumers", (path, frontend, compatibility) =>
  fixture(({ dir, base, write, commit }) => {
    write(path, "changed");
    expect(selectScope(base, commit(), dir)).toMatchObject({ frontend, compatibility });
  }),
);

test("changing the reviewed list cannot grant a same-change skip", () =>
  fixture(({ dir, base, write, commit }) => {
    write(registry, JSON.stringify([...reviewed, "apps/web/docs/new.md"]));
    write("apps/web/docs/new.md", "# New document");
    expect(selectScope(base, commit(), dir)).toMatchObject({ frontend: true, compatibility: true });
  }));

test("a large diff cannot hide a later frontend change", () =>
  fixture(({ dir, base, write, commit }) => {
    for (let i = 0; i < 3200; i++) write(`apps/backend/fixtures/${i}.txt`, "fixture");
    write("packages/ui/src/button.tsx", "export const Button = null;");
    const result = selectScope(base, commit(), dir);
    expect(result.paths).toHaveLength(3201);
    expect(result).toMatchObject({ frontend: true, compatibility: false });
  }));

test("deletions and both rename endpoints are inspected", () =>
  fixture(({ dir, base, write, commit }) => {
    rmSync(join(dir, reviewed[0]));
    expect(selectScope(base, commit(), dir)).toMatchObject({
      frontend: false,
      compatibility: false,
    });
    write("apps/web/src/old.ts", "plain text");
    const codeBase = commit();
    renameSync(join(dir, "apps/web/src/old.ts"), join(dir, reviewed[0]));
    const renamed = commit();
    expect(selectScope(codeBase, renamed, dir)).toMatchObject({ frontend: true });
    write("apps/web/src/new.ts", "plain text");
    rmSync(join(dir, reviewed[0]));
    expect(selectScope(renamed, commit(), dir)).toMatchObject({ frontend: true });
  }));

test.each(["mode", "symlink", "nul", "utf8"])("%s cannot masquerade as reviewed prose", (kind) =>
  fixture(({ dir, base, write, commit }) => {
    const path = reviewed[0];
    if (kind === "mode") chmodSync(join(dir, path), 0o755);
    if (kind === "symlink") {
      rmSync(join(dir, path));
      symlinkSync("docs/todo.md", join(dir, path));
    }
    if (kind === "nul") write(path, "# doc\0payload");
    if (kind === "utf8") write(path, new Uint8Array([0xff, 0xfe]));
    const head = commit();
    expect(selectScope(base, head, dir).frontend).toBe(true);
    expect(selectScope(head, base, dir).frontend).toBe(true);
  }),
);

test("source errors fail closed, empty ranges and manual dispatch run checks", () =>
  fixture(({ dir, base }) => {
    expect(() => selectScope("0".repeat(40), base, dir)).toThrow("EXACT_SOURCE_REQUIRED");
    expect(() => selectScope("a".repeat(40), base, dir)).toThrow(/git cat-file/);
    expect(selectScope(base, base, dir)).toMatchObject({ frontend: true, compatibility: true });
    expect(eventScope("workflow_dispatch", {}, base, dir)).toMatchObject({
      frontend: true,
      compatibility: true,
    });
    expect(() => eventScope("workflow_dispatch", {}, "a".repeat(40), dir)).toThrow(
      "CHECKOUT_SOURCE_MISMATCH",
    );
    expect(() =>
      eventScope("push", { before: base, after: base, ref: "refs/heads/other" }, base, dir),
    ).toThrow("PUSH_SOURCE_MISMATCH");
  }));

test("PR merge parents and main push range bind selection to the checked-out source", () =>
  fixture(({ dir, base, git, write, commit }) => {
    git("checkout", "-qb", "candidate");
    write(reviewed[0], "# PR document");
    const head = commit();
    git("checkout", "main");
    git("merge", "--no-ff", "-m", "merge", "candidate");
    const merge = git("rev-parse", "HEAD");
    const payload = { pull_request: { base: { sha: base }, head: { sha: head } } };
    expect(eventScope("pull_request", payload, merge, dir)).toMatchObject({
      frontend: false,
      compatibility: false,
    });
    expect(
      eventScope("push", { before: base, after: merge, ref: "refs/heads/main" }, merge, dir),
    ).toMatchObject({ frontend: false, compatibility: false });
    payload.pull_request.head.sha = base;
    expect(() => eventScope("pull_request", payload, merge, dir)).toThrow(
      "PR_MERGE_SOURCE_MISMATCH",
    );
    expect(() =>
      eventScope("push", { before: base, after: head, ref: "refs/heads/main" }, merge, dir),
    ).toThrow("PUSH_SOURCE_MISMATCH");
  }));
