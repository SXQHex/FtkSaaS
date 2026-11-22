import { createFileRoute } from "@tanstack/react-router";
import { loadScopedAccount, requireAccountSession } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { BusinessCentersRoutePage } from "../features/business/business-centers-page";

export const Route = createFileRoute("/o/$orgId/c/$centerId/centers")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: BusinessCentersRoutePage,
  errorComponent: AccountErrorPage,
});
