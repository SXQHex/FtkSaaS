import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { OverviewRoutePage } from "../features/overview/overview-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/overview")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: OverviewRoutePage,
  errorComponent: AccountErrorPage,
});
