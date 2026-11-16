import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { SessionDetailRoutePage } from "../features/session-detail/session-detail-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/sessions/$sessionId")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: SessionDetailRoutePage,
  errorComponent: AccountErrorPage,
});
