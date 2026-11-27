import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { ReportsRoutePage } from "../features/reports/reports-page";
import { validateReportSearch } from "../features/reports/report-search";
export const Route = createFileRoute("/o/$orgId/c/$centerId/reports")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  validateSearch: validateReportSearch,
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: ReportsRoutePage,
  errorComponent: PanelError,
});
