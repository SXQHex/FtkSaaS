import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { MergeRoutePage } from "../features/people/merge-page";

export const Route = createFileRoute("/o/$orgId/c/$centerId/people_/merge")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: MergeRoutePage,
  errorComponent: AccountErrorPage,
});
