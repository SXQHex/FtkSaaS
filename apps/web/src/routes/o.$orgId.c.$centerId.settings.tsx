import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { SettingsRoutePage } from "../features/settings/settings-page";
import { settingsLayout, type SettingsSection } from "../features/settings/settings-layout";
export const Route = createFileRoute("/o/$orgId/c/$centerId/settings")({
  validateSearch: (search): { section?: SettingsSection } => ({
    section: settingsLayout.find(({ key }) => key === search.section)?.key,
  }),
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: SettingsRoutePage,
  errorComponent: AccountErrorPage,
});
