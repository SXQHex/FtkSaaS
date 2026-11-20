import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { MemberAccountRoutePage } from "../features/member-account/member-account-page";
const search = z.object({ org: z.uuid().optional(), center: z.uuid().optional() });
export const Route = createFileRoute("/member/account")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  validateSearch: (input) => search.parse(input),
  component: MemberAccountRoutePage,
  errorComponent: AccountErrorPage,
});
