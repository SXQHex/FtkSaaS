import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { LeadsRoutePage } from "../features/leads/leads-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/leads")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: LeadsRoutePage,
  errorComponent: AccountErrorPage,
});
