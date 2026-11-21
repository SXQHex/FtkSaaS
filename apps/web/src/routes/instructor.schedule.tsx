import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { InstructorScheduleRoutePage } from "../features/instructor/instructor-schedule-page";
const search = z.object({ org: z.uuid().optional(), center: z.uuid().optional() });
export const Route = createFileRoute("/instructor/schedule")({
  beforeLoad: requireAccountSession,
  loaderDeps: ({ search: { org } }) => ({ org }),
  loader: loadAccount,
  validateSearch: (input) => search.parse(input),
  component: InstructorScheduleRoutePage,
  errorComponent: AccountErrorPage,
});
