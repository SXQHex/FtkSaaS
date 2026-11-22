import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { PeopleRoutePage } from "../features/people/people-page";

export const Route = createFileRoute("/o/$orgId/c/$centerId/people")({
  validateSearch: (search): { action?: "invite" } => ({
    action: search.action === "invite" ? "invite" : undefined,
  }),
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: PeopleRoutePage,
  errorComponent: AccountErrorPage,
});
