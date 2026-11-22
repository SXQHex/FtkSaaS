import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { useWorkspaceQuery, workspaceKeys } from "./workspace-query";

it("keeps disabled feature observers on the shell's exact Query cache", () => {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const value = {
    organizations: [],
    selected: { id: "org-a" },
    centers: [],
    roles: [],
  };
  queries.setQueryData(workspaceKeys.projection("actor-a", "org-a"), value);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>{children}</QueryClientProvider>
  );
  const observe = () => useWorkspaceQuery("actor-a", "org-a", false);
  const { result, unmount } = renderHook(observe, { wrapper });
  expect(result.current.data).toBe(value);
  expect(result.current.fetchStatus).toBe("idle");
  unmount();
  queries.clear();
});
