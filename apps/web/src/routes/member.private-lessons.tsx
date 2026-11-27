import { memberPanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { MemberPrivateLessonsRoutePage } from "../features/member-private-lessons/member-private-lessons-page";
const search = z.object({
  org: z.uuid().optional(),
  center: z.uuid().optional(),
  request: z.uuid().optional(),
});
export const Route = createFileRoute("/member/private-lessons")({
  staticData: memberPanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  validateSearch: (input) => search.parse(input),
  loaderDeps: ({ search: { org } }) => ({ org }),
  loader: ({ context, deps }) => loadScopedAccount(context, deps.org),
  component: MemberPrivateLessonsRoutePage,
  errorComponent: PanelError,
});
