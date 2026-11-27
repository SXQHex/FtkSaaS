import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { DocumentsRoutePage } from "../features/documents/documents-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/documents")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: DocumentsRoutePage,
  errorComponent: PanelError,
});
