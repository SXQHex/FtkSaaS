import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { MemberProfileRoutePage } from "../features/member-profile/member-profile-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/people_/$personId")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: MemberProfileRoutePage,
  errorComponent: AccountErrorPage,
});
