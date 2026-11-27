import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { ShortReportsRoutePage } from "../features/reports/reports-page";
import { validateReportSearch } from "../features/reports/report-search";

export const Route = createFileRoute("/reports")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  validateSearch: validateReportSearch,
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: ShortReportsRoutePage,
  errorComponent: PanelError,
});
