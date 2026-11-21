import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { InstructorSessionRoutePage } from "../features/instructor/instructor-session-page";
const search = z.object({ org: z.uuid().optional(), center: z.uuid().optional() });
export const Route = createFileRoute("/instructor/sessions/$sessionId")({
  beforeLoad: requireAccountSession,
  loaderDeps: ({ search: { org } }) => ({ org }),
  loader: loadAccount,
  validateSearch: (input) => search.parse(input),
  component: InstructorSessionRoutePage,
  errorComponent: AccountErrorPage,
});
