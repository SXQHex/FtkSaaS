import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { ScheduleRoutePage } from "../features/schedule/schedule-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/schedule")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: ScheduleRoutePage,
  errorComponent: AccountErrorPage,
});
