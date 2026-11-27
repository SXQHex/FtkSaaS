import { memberPanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { MemberAccountRoutePage } from "../features/member-account/member-account-page";
const search = z.object({ org: z.uuid().optional(), center: z.uuid().optional() });
export const Route = createFileRoute("/member/account")({
  staticData: memberPanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  validateSearch: (input) => search.parse(input),
  loaderDeps: ({ search: { org } }) => ({ org }),
  loader: ({ context, deps }) => loadScopedAccount(context, deps.org),
  component: MemberAccountRoutePage,
  errorComponent: PanelError,
});
