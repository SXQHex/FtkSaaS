import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { InstructorTodayRoutePage } from "../features/instructor/instructor-today-page";
const search = z.object({ org: z.uuid().optional(), center: z.uuid().optional() });
export const Route = createFileRoute("/instructor/today")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  validateSearch: (input) => search.parse(input),
  loaderDeps: ({ search: { org } }) => ({ org }),
  loader: ({ context, deps }) => loadScopedAccount(context, deps.org),
  component: InstructorTodayRoutePage,
  errorComponent: PanelError,
});
