import { FirstCenterSetup } from "../workspace/first-center-setup";
import { WorkspaceLayout } from "../workspace/workspace-layout";
import { AppearancePanel, type AppearanceActions } from "../account/appearance-panel";
import { useAccountAppearance } from "../account/use-account-appearance";
import { ProfilePanel } from "../account/profile-panel";
import { useIsMobile } from "../../hooks/use-mobile";
import { MonitorIcon, ShieldIcon, UserIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { SessionsPanel } from "../account/sessions-panel";
import { SecurityPanel } from "../account/security-panel";
import { useRef, useState } from "react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { getSupabaseClient } from "../../lib/supabase";
import { MemberCalendarPanel } from "../member-account/member-calendar-panel";
import { PersonalCalendarCard } from "../member-account/member-account-view";
import {
  hasWorkspaceManagementScope,
  workspaceRoles,
  type readWorkspace,
} from "../workspace/workspace";

// E10 is implemented in slices; the remaining scope is tracked in tasks/todo.md.
export function AccountPage() {
  const mobile = useIsMobile();
  const account = useLoaderData({ from: "/account" });
  const appearance = useAccountAppearance(account.id);
  const appearanceActions = useRef<AppearanceActions>(null);
  const [appearanceDisabled, setAppearanceDisabled] = useState(true);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const queries = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [setupLocked, setSetupLocked] = useState(false);
  const [instructorCalendarLocked, setInstructorCalendarLocked] = useState(false);
  const [studioCalendarLocked, setStudioCalendarLocked] = useState(false);
  const calendarLocked = instructorCalendarLocked || studioCalendarLocked;
  const accountLocked = setupLocked || calendarLocked;
  async function signOut() {
    if (accountLocked || pending) return;
    setPending(true);
    setFailed(false);
    const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
    if (error) {
      setFailed(true);
      setPending(false);
      return;
    }
    queries.clear();
    await navigate({ to: "/login", replace: true });
    await router.invalidate();
  }
  return (
    <WorkspaceLayout
      accountId={account.id}
      name={account.display_name}
      pending={pending || accountLocked}
      scopeLocked={accountLocked}
      onSignOut={() => {
        void signOut();
      }}
      onThemeChange={
        appearanceDisabled || accountLocked
          ? undefined
          : () => appearanceActions.current?.toggleTheme()
      }
    >
      {({ organizationId, centerId, workspace }) => (
        <div className="account-view flex min-w-0 w-full max-w-[76rem] flex-col gap-4 px-4 pt-5 pb-12 md:px-8">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{t(($) => $.auth.account)}</h1>
              <p className="text-muted-foreground">{t(($) => $.auth.accountDescription)}</p>
            </div>
            <Button
              variant="outline"
              isDisabled={pending || accountLocked}
              onPress={() => {
                void signOut();
              }}
            >
              {t(($) => $.auth.signout)}
            </Button>
          </header>
          {failed && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
            </Alert>
          )}
          <FirstCenterSetup
            key={`${account.id}:${organizationId ?? "none"}`}
            accountId={account.id}
            organizationId={organizationId}
            centerId={centerId}
            workspace={workspace}
            onLockChange={setSetupLocked}
          />
          <Tabs
            orientation={mobile ? "horizontal" : "vertical"}
            className="account-tabs"
            defaultSelectedKey="profile"
            disabledKeys={calendarLocked ? ["security", "sessions"] : undefined}
          >
            <TabsList variant="sidebar" aria-label={t(($) => $.security.sections)}>
              <TabsTrigger id="profile">
                <UserIcon />
                {t(($) => $.security.profile)}
              </TabsTrigger>
              <TabsTrigger id="security">
                <ShieldIcon />
                {t(($) => $.security.tab)}
              </TabsTrigger>
              <TabsTrigger id="sessions">
                <MonitorIcon />
                {t(($) => $.sessions.tab)}
              </TabsTrigger>
            </TabsList>
            <TabsContent
              id="profile"
              shouldForceMount
              className="flex flex-col gap-4 data-inert:hidden"
            >
              <ProfilePanel accountId={account.id} disabled={calendarLocked} />
              {organizationId && centerId && hasWorkspaceManagementScope(workspace, centerId) && (
                <PersonalCalendarCard kind="studio_program">
                  <MemberCalendarPanel
                    key={`${account.id}:${organizationId}:${centerId}`}
                    scope={{
                      accountId: account.id,
                      orgId: organizationId,
                      studioCenterId: centerId,
                    }}
                    kind="studio_program"
                    onLockChange={setStudioCalendarLocked}
                    disabled={setupLocked || pending || instructorCalendarLocked}
                  />
                </PersonalCalendarCard>
              )}
              {organizationId && hasInstructorCalendarScope(workspace) && (
                <PersonalCalendarCard kind="duties">
                  <MemberCalendarPanel
                    key={`${account.id}:${organizationId}`}
                    scope={{ accountId: account.id, orgId: organizationId }}
                    kind="duties"
                    onLockChange={setInstructorCalendarLocked}
                    disabled={setupLocked || pending || studioCalendarLocked}
                  />
                </PersonalCalendarCard>
              )}
              <AppearancePanel
                ref={appearanceActions}
                onDisabledChange={setAppearanceDisabled}
                snapshot={appearance.data}
                readError={appearance.isError}
                onRefresh={async () => {
                  const result = await appearance.refetch({ throwOnError: true });
                  if (!result.data) throw new Error("APPEARANCE_UNAVAILABLE");
                  return result.data;
                }}
              />
            </TabsContent>
            <TabsContent id="security">
              <SecurityPanel accountId={account.id} />
            </TabsContent>
            <TabsContent id="sessions">
              <SessionsPanel accountId={account.id} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </WorkspaceLayout>
  );
}

function hasInstructorCalendarScope(
  workspace: Awaited<ReturnType<typeof readWorkspace>> | undefined,
) {
  return workspace?.centers.some(
    (center) =>
      center.accessible &&
      (workspaceRoles(workspace, center.id).includes("instructor") ||
        workspace.selected?.self_context?.centers.some(
          (context) => context.center_id === center.id && context.instructor,
        )),
  );
}

export { RouteErrorPage as AccountErrorPage } from "../states/route-state-pages";
