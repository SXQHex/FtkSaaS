import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { EventsRoutePage } from "../features/events/events-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/events")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: EventsRoutePage,
  errorComponent: PanelError,
});
