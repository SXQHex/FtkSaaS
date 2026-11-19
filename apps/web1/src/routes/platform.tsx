import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { loadPlatformAccount, requireAccountSession } from "../features/auth/account-guard";
import { PlatformRoutePage } from "../features/platform/platform-page";

export const Route = createFileRoute("/platform")({
  beforeLoad: requireAccountSession,
  loader: loadPlatformAccount,
  validateSearch: z.object({
    organization_id: z.uuid().optional(),
    section: z.literal("payments").optional(),
    payment_id: z.uuid().optional(),
  }),
  component: PlatformRoutePage,
});
