import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { AuditRoutePage } from "../features/audit/audit-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/audit")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: AuditRoutePage,
  errorComponent: AccountErrorPage,
});
