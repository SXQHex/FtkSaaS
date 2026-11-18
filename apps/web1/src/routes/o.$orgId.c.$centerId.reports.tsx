import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { ReportsRoutePage } from "../features/reports/reports-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/reports")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: ReportsRoutePage,
  errorComponent: AccountErrorPage,
});
