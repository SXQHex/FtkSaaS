import "../../i18n";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { readCreatedCenter } from "./center-create";
import { workspaceKeys } from "./workspace-query";

type CreatedCenter = Awaited<ReturnType<typeof readCreatedCenter>>;
type CommandRefresh = { onRefresh: (result: CreatedCenter) => Promise<void> };
const { command, router } = vi.hoisted(() => ({
  command: vi.fn<(options: CommandRefresh) => void>(),
  router: { invalidate: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => router }));
vi.mock("../member-profile/use-member-command", () => ({
  useMemberCommand: (options: CommandRefresh) => {
    command(options);
    return {
      state: "ready",
      locked: false,
      busy: false,
      start: vi.fn(),
      retry: vi.fn(),
      readReceipt: vi.fn(),
      reset: vi.fn(),
    };
  },
}));

import { FirstCenterSetup } from "./first-center-setup";

afterEach(() => {
  vi.clearAllMocks();
});

it("keeps an owned center result without replacing the newer session's shared workspace", async () => {
  const accountId = "019a7b00-0000-7000-8000-000000000001";
  const orgId = "019a7b00-0000-7000-8000-000000000002";
  const center: CreatedCenter["center"] = {
    id: "019a7b00-0000-7000-8000-000000000003",
    name: "Owned native result",
    timezone: "Europe/Istanbul",
    state: "active",
    accessible: true,
    version: 1,
  };
  const previous: CreatedCenter = {
    center,
    workspace: { organizations: [], selected: undefined, centers: [center], roles: [] },
  };
  const current: CreatedCenter["workspace"] = {
    organizations: [],
    selected: undefined,
    centers: [],
    roles: [],
  };
  const queries = new QueryClient();
  const key = workspaceKeys.projection(accountId, orgId);
  // The Router has already read this shared projection in the newer session.
  queries.setQueryData(key, current);
  const { unmount } = render(
    <QueryClientProvider client={queries}>
      <FirstCenterSetup accountId={accountId} organizationId={orgId} onLockChange={vi.fn()} />
    </QueryClientProvider>,
  );
  const refresh = command.mock.calls[0]?.[0].onRefresh;
  if (!refresh) throw new Error("CENTER_COMMAND_NOT_REGISTERED");

  // A validated readback still belongs to its native command even when its
  // old workspace snapshot is no longer the current session's authority.
  await act(async () => {
    await refresh(previous);
  });

  expect(queries.getQueryData(key)).toBe(current);
  expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  expect(screen.getByRole("link")).toHaveAttribute("href", `/o/${orgId}/c/${center.id}/settings`);
  unmount();
  queries.clear();
});
