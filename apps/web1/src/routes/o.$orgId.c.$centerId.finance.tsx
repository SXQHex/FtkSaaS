import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { FinanceRoutePage } from "../features/finance/finance-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/finance")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: FinanceRoutePage,
  errorComponent: AccountErrorPage,
});
