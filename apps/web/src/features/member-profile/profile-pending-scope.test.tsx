import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ClientScope } from "../../lib/scoped-backend";

const state = vi.hoisted(() => ({
  selection: { organizationId: "fixture-org", centerId: "fixture-center" } as {
    organizationId?: string;
    centerId?: string;
  },
  accountId: "fixture-account",
  personId: "fixture-person",
  mounts: 0,
  unmounts: 0,
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ orgId: "fixture-org", centerId: "fixture-center", personId: state.personId }),
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
}));
vi.mock("../auth/use-account-projection", () => ({
  useAccountProjection: () => ({ id: state.accountId, display_name: "Fixture" }),
}));
vi.mock("react-i18next", async () => {
  const { default: common } = await import("../../locales/tr/common.json");
  return {
    useTranslation: () => ({
      t: (selector: (catalog: typeof common) => string) => selector(common),
    }),
  };
});
vi.mock("../account/use-account-appearance", () => ({ useAccountAppearance: vi.fn() }));
vi.mock("../workspace/workspace-layout", () => ({
  WorkspaceLayout: ({
    children,
  }: {
    children: (selection: typeof state.selection) => ReactNode;
  }) => <section>{children(state.selection)}</section>,
}));
vi.mock("./member-profile-content", async () => {
  const { useEffect } = await import("react");
  return {
    MemberProfileContent: ({
      scope,
      personId,
      onLockChange,
      preservePending,
    }: {
      scope: ClientScope;
      personId: string;
      onLockChange: (locked: boolean) => void;
      preservePending?: boolean;
    }) => {
      useEffect(() => {
        state.mounts++;
        return () => {
          state.unmounts++;
        };
      }, []);
      return (
        <div>
          <output data-testid="command-scope" data-pending={String(preservePending)}>
            {scope.accountId}:{scope.orgId}:{scope.centerId}:{personId}
          </output>
          <button type="button" onClick={() => onLockChange(true)}>
            Freeze command
          </button>
        </div>
      );
    },
  };
});
import { MemberProfileRoutePage } from "./member-profile-page";
beforeEach(() => {
  state.selection = { organizationId: "fixture-org", centerId: "fixture-center" };
  state.accountId = "fixture-account";
  state.personId = "fixture-person";
  state.mounts = 0;
  state.unmounts = 0;
});
function page() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const element = () => (
    <QueryClientProvider client={client}>
      <MemberProfileRoutePage />
    </QueryClientProvider>
  );
  const view = render(element());
  return { rerender: () => view.rerender(element()) };
}
it("keeps a frozen command frame mounted when the live workspace temporarily loses its selection", () => {
  const view = page();
  fireEvent.click(screen.getByRole("button", { name: "Freeze command" }));
  state.selection = {};
  view.rerender();
  expect(screen.getByTestId("command-scope")).toHaveTextContent(
    "fixture-account:fixture-org:fixture-center:fixture-person",
  );
  expect(screen.getByTestId("command-scope")).toHaveAttribute("data-pending", "true");
  expect(state.mounts).toBe(1);
  expect(state.unmounts).toBe(0);
});
it("does not retain an unlocked private view after its selection disappears", () => {
  const view = page();
  state.selection = {};
  view.rerender();
  expect(screen.queryByTestId("command-scope")).toBeNull();
  expect(state.unmounts).toBe(1);
});
it("remounts and clears the old lock when the authenticated account changes", () => {
  const view = page();
  fireEvent.click(screen.getByRole("button", { name: "Freeze command" }));
  state.accountId = "another-fixture-account";
  view.rerender();
  expect(screen.getByTestId("command-scope")).toHaveTextContent(
    "another-fixture-account:fixture-org:fixture-center:fixture-person",
  );
  expect(screen.getByTestId("command-scope")).toHaveAttribute("data-pending", "false");
  expect(state.mounts).toBe(2);
  expect(state.unmounts).toBe(1);
});

it("clears the old person command frame when the route selects another native person", () => {
  const view = page();
  fireEvent.click(screen.getByRole("button", { name: "Freeze command" }));
  state.personId = "another-person";
  view.rerender();
  expect(screen.getByTestId("command-scope")).toHaveTextContent(
    "fixture-account:fixture-org:fixture-center:another-person",
  );
  expect(screen.getByTestId("command-scope")).toHaveAttribute("data-pending", "false");
  expect(state.mounts).toBe(2);
  expect(state.unmounts).toBe(1);
});
