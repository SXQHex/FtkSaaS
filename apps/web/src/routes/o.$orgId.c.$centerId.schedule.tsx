import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { ScheduleRoutePage } from "../features/schedule/schedule-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/schedule")({
  validateSearch: (search) =>
    z
      .object({
        session: z.uuid().optional(),
        create: z.boolean().optional(),
        action: z.enum(["edit", "instructor", "cancel"]).optional(),
      })
      .parse(search),
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: ScheduleRoutePage,
  errorComponent: AccountErrorPage,
});
