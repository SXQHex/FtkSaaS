import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { MergeRoutePage } from "../features/people/merge-page";

export const Route = createFileRoute("/o/$orgId/c/$centerId/people_/merge")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: MergeRoutePage,
  errorComponent: PanelError,
});
