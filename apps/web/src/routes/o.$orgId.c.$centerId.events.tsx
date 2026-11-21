import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { EventsRoutePage } from "../features/events/events-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/events")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: EventsRoutePage,
  errorComponent: AccountErrorPage,
});
