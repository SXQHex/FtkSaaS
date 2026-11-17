import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { MemberEntitlementsRoutePage } from "../features/member-entitlements/member-entitlements-page";
const search = z.object({ org: z.uuid().optional(), center: z.uuid().optional() });
export const Route = createFileRoute("/member/entitlements")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  validateSearch: (input) => search.parse(input),
  component: MemberEntitlementsRoutePage,
  errorComponent: AccountErrorPage,
});
