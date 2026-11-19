import { createFileRoute } from "@tanstack/react-router";
import { loadAccount, requireAccountSession } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { BusinessCentersRoutePage } from "../features/business/business-centers-page";

export const Route = createFileRoute("/o/$orgId/c/$centerId/centers")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: BusinessCentersRoutePage,
  errorComponent: AccountErrorPage,
});
