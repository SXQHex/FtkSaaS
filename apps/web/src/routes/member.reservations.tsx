import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { MemberReservationsRoutePage } from "../features/member-reservations/member-reservations-page";
const search = z.object({
  org: z.uuid().optional(),
  center: z.uuid().optional(),
  session: z.uuid().optional(),
  offer: z.uuid().optional(),
});
export const Route = createFileRoute("/member/reservations")({
  beforeLoad: requireAccountSession,
  validateSearch: (input) => search.parse(input),
  loaderDeps: ({ search: { org } }) => ({ org }),
  loader: ({ context, deps }) => loadScopedAccount(context, deps.org),
  component: MemberReservationsRoutePage,
  errorComponent: AccountErrorPage,
});
