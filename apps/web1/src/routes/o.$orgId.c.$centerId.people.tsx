import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { PeopleRoutePage } from "../features/people/people-page";

export const Route = createFileRoute("/o/$orgId/c/$centerId/people")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: PeopleRoutePage,
  errorComponent: AccountErrorPage,
});
