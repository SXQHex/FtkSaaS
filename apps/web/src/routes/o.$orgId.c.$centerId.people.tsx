import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { PeopleRoutePage } from "../features/people/people-page";

export const Route = createFileRoute("/o/$orgId/c/$centerId/people")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  validateSearch: (search): { action?: "invite" } => ({
    action: search.action === "invite" ? "invite" : undefined,
  }),
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: PeopleRoutePage,
  errorComponent: PanelError,
});
