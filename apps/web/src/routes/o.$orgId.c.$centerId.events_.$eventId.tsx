import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { EventDetailRoutePage } from "../features/events/event-detail-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/events_/$eventId")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: EventDetailRoutePage,
  errorComponent: PanelError,
});
