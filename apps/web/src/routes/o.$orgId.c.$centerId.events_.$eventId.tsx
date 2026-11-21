import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { EventDetailRoutePage } from "../features/events/event-detail-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/events_/$eventId")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: EventDetailRoutePage,
  errorComponent: AccountErrorPage,
});
