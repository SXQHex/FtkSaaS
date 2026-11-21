import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { FinanceRoutePage } from "../features/finance/finance-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/finance")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: FinanceRoutePage,
  errorComponent: AccountErrorPage,
});
