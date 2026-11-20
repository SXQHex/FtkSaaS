import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { ShortReportsRoutePage } from "../features/reports/reports-page";
import { validateReportSearch } from "../features/reports/report-search";

export const Route = createFileRoute("/reports")({
  validateSearch: validateReportSearch,
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: ShortReportsRoutePage,
  errorComponent: AccountErrorPage,
});
