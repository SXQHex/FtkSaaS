import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { EarningsRoutePage } from "../features/earnings/earnings-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/earnings")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: EarningsRoutePage,
  errorComponent: AccountErrorPage,
});
