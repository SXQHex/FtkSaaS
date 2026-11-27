import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { OverviewRoutePage } from "../features/overview/overview-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/overview")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: OverviewRoutePage,
  errorComponent: PanelError,
});
