import { memo, type ReactNode } from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { clearPrivateQueries } from "../../lib/cache-invalidation";
import { PrivateSessionRevision } from "../auth/private-session-revision";
import { useWorkspaceQuery, workspaceKeys } from "./workspace-query";
import * as workspaceSource from "./workspace";

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
  function useObservedWorkspace() {
    return useWorkspaceQuery("actor-a", "org-a", false);
  }
  const { result, unmount } = renderHook(useObservedWorkspace, { wrapper });
  expect(result.current.data).toBe(value);
  expect(result.current.fetchStatus).toBe("idle");
  unmount();
  queries.clear();
});

it("reattaches an unchanged feature observer to the workspace rebuilt by a new session", async () => {
  const read = vi.spyOn(workspaceSource, "readWorkspace");
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = workspaceKeys.projection("actor-a", "org-a");
  const workspace = { organizations: [], centers: [], roles: [] };
  queries.setQueryData(key, { ...workspace, selected: { id: "org-a", name: "Old workspace" } });
  const Probe = memo(function Probe() {
    const query = useWorkspaceQuery("actor-a", "org-a", false);
    return <output>{query.data?.selected?.name ?? query.fetchStatus}</output>;
  });
  function Session({ revision }: { revision: number }) {
    return (
      <QueryClientProvider client={queries}>
        <PrivateSessionRevision value={revision}>
          <Probe />
        </PrivateSessionRevision>
      </QueryClientProvider>
    );
  }
  const view = render(<Session revision={0} />);
  expect(screen.getByText("Old workspace")).toBeVisible();
  act(() => queries.removeQueries());
  view.rerender(<Session revision={1} />);
  expect(screen.queryByText("Old workspace")).not.toBeInTheDocument();
  expect(screen.getByText("idle")).toBeVisible();
  await act(async () =>
    queries.setQueryData(key, { ...workspace, selected: { id: "org-a", name: "New workspace" } }),
  );
  expect(await screen.findByText("New workspace")).toBeVisible();

  await act(async () => {
    clearPrivateQueries(queries);
    queries.setQueryData(key, {
      ...workspace,
      selected: { id: "org-a", name: "Revalidated workspace" },
    });
  });
  expect(await screen.findByText("Revalidated workspace")).toBeVisible();
  expect(screen.queryByText("New workspace")).not.toBeInTheDocument();
  expect(read).not.toHaveBeenCalled();
});
