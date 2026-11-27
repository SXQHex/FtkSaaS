import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { MemberProfileRoutePage } from "../features/member-profile/member-profile-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/people_/$personId")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: MemberProfileRoutePage,
  errorComponent: PanelError,
});
