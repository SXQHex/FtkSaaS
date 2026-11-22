import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { ReportsRoutePage } from "../features/reports/reports-page";
import { validateReportSearch } from "../features/reports/report-search";
export const Route = createFileRoute("/o/$orgId/c/$centerId/reports")({
  validateSearch: validateReportSearch,
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: ReportsRoutePage,
  errorComponent: AccountErrorPage,
});
