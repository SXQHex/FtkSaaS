import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { SettingsRoutePage } from "../features/settings/settings-page";
import { settingsLayout, type SettingsSection } from "../features/settings/settings-layout";
export const Route = createFileRoute("/o/$orgId/c/$centerId/settings")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  validateSearch: (search): { section?: SettingsSection } => ({
    section: settingsLayout.find(({ key }) => key === search.section)?.key,
  }),
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: SettingsRoutePage,
  errorComponent: PanelError,
});
