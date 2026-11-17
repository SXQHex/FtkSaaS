import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { EventsRoutePage } from "../features/events/events-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/events")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: EventsRoutePage,
  errorComponent: AccountErrorPage,
});
