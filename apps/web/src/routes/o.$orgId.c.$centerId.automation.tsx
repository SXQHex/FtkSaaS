import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { AutomationRoutePage } from "../features/automation/automation-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/automation")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: AutomationRoutePage,
  errorComponent: AccountErrorPage,
});
