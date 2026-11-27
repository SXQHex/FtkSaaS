import { memberPanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { MemberEntitlementsRoutePage } from "../features/member-entitlements/member-entitlements-page";
const search = z.object({ org: z.uuid().optional(), center: z.uuid().optional() });
export const Route = createFileRoute("/member/entitlements")({
  staticData: memberPanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  validateSearch: (input) => search.parse(input),
  loaderDeps: ({ search: { org } }) => ({ org }),
  loader: ({ context, deps }) => loadScopedAccount(context, deps.org),
  component: MemberEntitlementsRoutePage,
  errorComponent: PanelError,
});
