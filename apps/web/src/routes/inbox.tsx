import { inboxPanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { InboxRoutePage } from "../features/inbox/inbox-page";
const search = z.object({
  org: z.uuid().optional(),
  center: z.uuid().optional(),
  view: z.literal("member").optional(),
});
export const Route = createFileRoute("/inbox")({
  staticData: inboxPanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  validateSearch: (input) => search.parse(input),
  loaderDeps: ({ search: { org } }) => ({ org }),
  loader: ({ context, deps }) => loadScopedAccount(context, deps.org),
  component: InboxRoutePage,
  errorComponent: PanelError,
});
