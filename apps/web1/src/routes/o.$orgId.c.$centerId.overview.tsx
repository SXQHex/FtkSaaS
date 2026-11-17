import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { OverviewRoutePage } from "../features/overview/overview-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/overview")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: OverviewRoutePage,
  errorComponent: AccountErrorPage,
});
