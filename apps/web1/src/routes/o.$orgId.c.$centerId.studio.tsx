import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { StudioRoutePage } from "../features/studio/studio-page";

export const Route = createFileRoute("/o/$orgId/c/$centerId/studio")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: StudioRoutePage,
  errorComponent: AccountErrorPage,
});
