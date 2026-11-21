import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { StudioRoutePage } from "../features/studio/studio-page";

export const Route = createFileRoute("/o/$orgId/c/$centerId/studio")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: StudioRoutePage,
  errorComponent: AccountErrorPage,
});
