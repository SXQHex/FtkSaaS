import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { workspaceQuery } from "./workspace-query";
import type { readWorkspace } from "./workspace";

describe("workspace cache reuse", () => {
  const workspace = {
    organizations: [],
    centers: [],
    roles: [],
    selected: { id: "org-a" },
  } as unknown as Awaited<ReturnType<typeof readWorkspace>>;
  it("reuses a resolved organization with its original freshness timestamp", () => {
    const queries = new QueryClient();
    queries.setQueryData(["workspace", "actor-a", null], workspace, { updatedAt: 1000 });
    const options = workspaceQuery(queries, "actor-a", "org-a");
    expect(options.initialData).toBe(workspace);
    expect(options.initialDataUpdatedAt).toBe(1000);
    expect(options.queryKey).toEqual(["workspace", "actor-a", "org-a"]);
  });
  it("does not reuse another actor, organization, invalidated result or signed-out cache", async () => {
    const queries = new QueryClient();
    queries.setQueryData(["workspace", "actor-a", null], workspace);
    expect(workspaceQuery(queries, "actor-b", "org-a").initialData).toBeUndefined();
    expect(workspaceQuery(queries, "actor-a", "org-b").initialData).toBeUndefined();
    await queries.invalidateQueries({ queryKey: ["workspace", "actor-a"] });
    expect(workspaceQuery(queries, "actor-a", "org-a").initialData).toBeUndefined();
    queries.clear();
    expect(workspaceQuery(queries, "actor-a", "org-a").initialData).toBeUndefined();
  });
});
