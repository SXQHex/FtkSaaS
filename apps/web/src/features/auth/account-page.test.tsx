import "../../i18n";
import type { ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { isCancelledError, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { readWorkspace } from "../workspace/workspace";
import { workspaceKeys } from "../workspace/workspace-query";

type Workspace = Awaited<ReturnType<typeof readWorkspace>>;
type SetupProps = { onOrganizationReady: (organizationId: string) => Promise<void> };
type WorkspaceProps = {
  children: (view: { workspace: Workspace; loading: boolean }) => ReactNode;
};
const { reader, setup } = vi.hoisted(() => ({
  reader: vi.fn<typeof readWorkspace>(),
  setup: vi.fn<(props: SetupProps) => void>(),
}));
vi.mock("../workspace/workspace", async (original) => ({
  ...(await original<typeof import("../workspace/workspace")>()),
  readWorkspace: reader,
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));
vi.mock("@ftksaas/ui/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("./use-account-projection", () => ({
  useAccountProjection: () => ({
    id: "019a7b00-0000-7000-8000-000000000001",
    display_name: "Fixture",
    identity: { email_verified_at: "2026-11-14T06:00:00Z" },
  }),
}));
vi.mock("../account/use-account-appearance", () => ({
  useAccountAppearance: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
}));
vi.mock("../account/appearance-panel", () => ({ AppearancePanel: () => null }));
vi.mock("../account/profile-panel", () => ({ ProfilePanel: () => null }));
vi.mock("../account/security-panel", () => ({ SecurityPanel: () => null }));
vi.mock("../account/sessions-panel", () => ({ SessionsPanel: () => null }));
vi.mock("../workspace/studio-setup-request-card", () => ({
  StudioSetupRequestCard: (props: SetupProps) => {
    setup(props);
    return null;
  },
}));
vi.mock("../workspace/workspace-layout", () => ({
  WorkspaceLayout: ({ children }: WorkspaceProps) =>
    children({
      workspace: { organizations: [], selected: undefined, centers: [], roles: [] },
      loading: false,
    }),
}));

import { AccountPage } from "./account-page";

afterEach(() => {
  vi.clearAllMocks();
});

it("does not restore an old setup workspace after the same account receives a new session", async () => {
  const accountId = "019a7b00-0000-7000-8000-000000000001";
  const orgId = "019a7b00-0000-7000-8000-000000000002";
  const oldOrganization: Workspace["organizations"][number] = {
    id: orgId,
    name: "Previous session workspace",
    state: "active",
    access_mode: "normal",
    version: 1,
    self_context: null,
  };
  const previous: Workspace = {
    organizations: [oldOrganization],
    selected: oldOrganization,
    centers: [],
    roles: [],
  };
  const current: Workspace = {
    organizations: [],
    selected: undefined,
    centers: [],
    roles: [],
  };
  let release!: (value: Workspace) => void;
  reader.mockReturnValue(
    new Promise<Workspace>((resolve) => {
      release = resolve;
    }),
  );
  const queries = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  const key = workspaceKeys.projection(accountId);
  queries.setQueryData(key, current);
  const { unmount } = render(
    <QueryClientProvider client={queries}>
      <AccountPage />
    </QueryClientProvider>,
  );
  const refresh = setup.mock.calls[0]?.[0].onOrganizationReady;
  if (!refresh) throw new Error("STUDIO_SETUP_NOT_REGISTERED");
  let previousError: unknown;
  const refreshing = refresh(orgId).catch((error: unknown) => {
    previousError = error;
  });
  try {
    await waitFor(() => expect(reader).toHaveBeenCalledOnce());
    // This is the real same-user handoff's cache eviction, followed by the
    // Router's newer-session projection before the old request completes.
    queries.removeQueries();
    queries.setQueryData(key, current);
    release(previous);
    await refreshing;

    expect(isCancelledError(previousError)).toBe(true);
    expect(queries.getQueryData(key)).toBe(current);
    expect(reader.mock.calls[0]?.[3]?.aborted).toBe(true);
  } finally {
    release(previous);
    unmount();
    queries.clear();
  }
});
