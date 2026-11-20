import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { LessonRequestsRoutePage } from "../features/lesson-requests/lesson-requests-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/requests")({
  validateSearch: (input) => z.object({ request: z.uuid().optional() }).parse(input),
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: LessonRequestsRoutePage,
  errorComponent: AccountErrorPage,
});
