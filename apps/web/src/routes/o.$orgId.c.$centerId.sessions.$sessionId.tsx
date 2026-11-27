import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { SessionDetailRoutePage } from "../features/session-detail/session-detail-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/sessions/$sessionId")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  validateSearch: (search) =>
    z.object({ tab: z.enum(["participants", "attendance", "waitlist"]).optional() }).parse(search),
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: SessionDetailRoutePage,
  errorComponent: PanelError,
});
