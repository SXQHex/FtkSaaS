import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { MergeRoutePage } from "../features/people/merge-page";

export const Route = createFileRoute("/o/$orgId/c/$centerId/people_/merge")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: MergeRoutePage,
  errorComponent: AccountErrorPage,
});
