import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { AutomationRoutePage } from "../features/automation/automation-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/automation")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: AutomationRoutePage,
  errorComponent: AccountErrorPage,
});
