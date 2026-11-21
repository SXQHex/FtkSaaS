import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { AuditRoutePage } from "../features/audit/audit-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/audit")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: AuditRoutePage,
  errorComponent: AccountErrorPage,
});
