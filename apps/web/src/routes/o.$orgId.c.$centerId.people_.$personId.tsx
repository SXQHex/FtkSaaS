import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { MemberProfileRoutePage } from "../features/member-profile/member-profile-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/people_/$personId")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: MemberProfileRoutePage,
  errorComponent: AccountErrorPage,
});
