import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { MemberPrivateLessonsRoutePage } from "../features/member-private-lessons/member-private-lessons-page";
const search = z.object({
  org: z.uuid().optional(),
  center: z.uuid().optional(),
  request: z.uuid().optional(),
});
export const Route = createFileRoute("/member/private-lessons")({
  beforeLoad: requireAccountSession,
  loaderDeps: ({ search: { org } }) => ({ org }),
  loader: loadAccount,
  validateSearch: (input) => search.parse(input),
  component: MemberPrivateLessonsRoutePage,
  errorComponent: AccountErrorPage,
});
