import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { EventDetailRoutePage } from "../features/events/event-detail-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/events_/$eventId")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: EventDetailRoutePage,
  errorComponent: AccountErrorPage,
});
