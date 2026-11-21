import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { accountQueryKeys } from "./account-query";
import { useAccountProjection } from "./use-account-projection";

vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ matches: [{ context: { authUserId: "native-a" } }] }),
}));

it("subscribes the protected screen to Query account updates, not a Router snapshot", async () => {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = accountQueryKeys.projection("native-a");
  queries.setQueryData(key, { id: "backend-a", display_name: "Original" });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useAccountProjection(), { wrapper });
  expect(result.current.display_name).toBe("Original");
  act(() => {
    queries.setQueryData(key, { id: "backend-a", display_name: "Updated" });
  });
  await waitFor(() => expect(result.current.display_name).toBe("Updated"));
});

it("does not consume an ordinary projection in a privileged account screen", () => {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queries.setQueryData(accountQueryKeys.projection("native-a"), {
    id: "backend-a",
    display_name: "Ordinary",
  });
  queries.setQueryData(accountQueryKeys.projection("native-a", true), {
    id: "backend-a",
    display_name: "Privileged",
    platform_scope: { organizations: true },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useAccountProjection(true), { wrapper });
  expect(result.current.display_name).toBe("Privileged");
  expect(result.current.platform_scope?.organizations).toBe(true);
});
