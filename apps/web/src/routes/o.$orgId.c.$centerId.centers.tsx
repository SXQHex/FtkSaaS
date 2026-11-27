import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { loadScopedAccount, requireAccountSession } from "../features/auth/account-guard";
import { BusinessCentersRoutePage } from "../features/business/business-centers-page";

export const Route = createFileRoute("/o/$orgId/c/$centerId/centers")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: BusinessCentersRoutePage,
  errorComponent: PanelError,
});
