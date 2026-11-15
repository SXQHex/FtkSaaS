import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { AccessRoutePage } from "../features/access/access-page";

export const Route = createFileRoute("/o/$orgId/c/$centerId/access")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: AccessRoutePage,
  errorComponent: AccountErrorPage,
});
