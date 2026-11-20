import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { InboxRoutePage } from "../features/inbox/inbox-page";
const search = z.object({
  org: z.uuid().optional(),
  center: z.uuid().optional(),
  view: z.literal("member").optional(),
});
export const Route = createFileRoute("/inbox")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  validateSearch: (input) => search.parse(input),
  component: InboxRoutePage,
  errorComponent: AccountErrorPage,
});
