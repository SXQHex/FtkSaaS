import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { SessionDetailRoutePage } from "../features/session-detail/session-detail-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/sessions/$sessionId")({
  validateSearch: (search) =>
    z.object({ tab: z.enum(["participants", "attendance", "waitlist"]).optional() }).parse(search),
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: SessionDetailRoutePage,
  errorComponent: AccountErrorPage,
});
