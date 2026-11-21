import { FirstCenterSetup } from "../workspace/first-center-setup";
import { StudioSetupRequestCard } from "../workspace/studio-setup-request-card";
import { WorkspaceLayout } from "../workspace/workspace-layout";
import { WorkspaceEntry } from "../workspace/workspace-entry";
import { Skeleton } from "@ftksaas/ui/components/skeleton";
import { AppearancePanel, type AppearanceActions } from "../account/appearance-panel";
import { useAccountAppearance } from "../account/use-account-appearance";
import { ProfilePanel } from "../account/profile-panel";
import { useIsMobile } from "@ftksaas/ui/hooks/use-mobile";
import { MonitorIcon, ShieldIcon, UserIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@ftksaas/ui/components/tabs";
import { SessionsPanel } from "../account/sessions-panel";
import { SecurityPanel } from "../account/security-panel";
import { useRef, useState } from "react";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAccountProjection } from "./use-account-projection";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button, LinkButton } from "@ftksaas/ui/components/button";
import { getSupabaseClient } from "../../lib/supabase";
import { MemberCalendarPanel } from "../member-account/member-calendar-panel";
import { PersonalCalendarCard } from "../member-account/member-account-view";
import { hasWorkspaceManagementScope, workspaceRoles, readWorkspace } from "../workspace/workspace";

export function AccountPage() {
  const mobile = useIsMobile();
  const account = useAccountProjection(true);
  const search = useSearch({ from: "/account" });
  const appearance = useAccountAppearance(account.id);
  const appearanceActions = useRef<AppearanceActions>(null);
  const [appearanceDisabled, setAppearanceDisabled] = useState(true);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const queries = useQueryClient();
  const [organizationChoice, setOrganizationChoice] = useState(search.org);
  const [centerChoice, setCenterChoice] = useState(search.center);
  const accountHeading = useRef<HTMLHeadingElement>(null);
  const [entryDismissed, setEntryDismissed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [setupLocked, setSetupLocked] = useState(false);
  const [requestLocked, setRequestLocked] = useState(false);
  const [instructorCalendarLocked, setInstructorCalendarLocked] = useState(false);
  const [studioCalendarLocked, setStudioCalendarLocked] = useState(false);
  const calendarLocked = instructorCalendarLocked || studioCalendarLocked;
  const accountLocked = setupLocked || requestLocked || calendarLocked;
  function chooseOrganization(id?: string) {
    setOrganizationChoice(id);
    setCenterChoice(undefined);
  }
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
  async function continueStudioSetup(organizationId: string) {
    const workspace = await readWorkspace(account.id);
    if (!workspace.organizations.some((organization) => organization.id === organizationId))
      throw Error("STUDIO_SETUP_ORGANIZATION_UNAVAILABLE");
    queries.setQueryData(["workspace", account.id, null], workspace);
  }
  function setupPanel(
    organizationId: string | undefined,
    centerId: string | undefined,
    workspace: Awaited<ReturnType<typeof readWorkspace>> | undefined,
  ) {
    const eligible = Boolean(
      account.identity?.email_verified_at && workspace && workspace.organizations.length === 0,
    );
    if (eligible || requestLocked)
      return (
        <StudioSetupRequestCard
          key={account.id}
          accountId={account.id}
          eligible={eligible}
          onLockChange={setRequestLocked}
          onOrganizationReady={continueStudioSetup}
        />
      );
    return (
      <FirstCenterSetup
        key={`${account.id}:${organizationId ?? "none"}`}
        accountId={account.id}
        organizationId={organizationId}
        centerId={centerId}
        workspace={workspace}
        onLockChange={setSetupLocked}
      />
    );
  }
  return (
    <WorkspaceLayout
      accountId={account.id}
      name={account.display_name}
      pending={pending || accountLocked}
      scopeLocked={accountLocked}
      scopeControl={{
        organizationId: organizationChoice,
        centerId: centerChoice,
        onOrganization: chooseOrganization,
        onCenter: setCenterChoice,
      }}
      onSignOut={() => {
        void signOut();
      }}
      onThemeChange={
        appearanceDisabled || accountLocked
          ? undefined
          : () => appearanceActions.current?.toggleTheme()
      }
    >
      {({ organizationId, centerId, workspace, loading }) => {
        const organizations = workspace?.organizations ?? [];
        const activeCenters =
          workspace?.centers.filter((center) => center.state === "active") ?? [];
        const needsOrganization = organizations.length > 1 && !organizationId;
        const needsCenter = Boolean(
          organizationId &&
          workspace?.selected?.access_mode !== "closed" &&
          activeCenters.length > 1 &&
          !activeCenters.some((center) => center.id === centerId),
        );
        const showEntry = !entryDismissed && (needsOrganization || needsCenter);
        const waitingForEntry = !entryDismissed && Boolean(organizationChoice) && !workspace;
        const continueToAccount = () => {
          setEntryDismissed(true);
          accountHeading.current?.focus();
        };
        return (
          <div className="account-view flex min-w-0 w-full max-w-[76rem] flex-col gap-4 px-4 pt-5 pb-12 md:px-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold" ref={accountHeading} tabIndex={-1}>
                  {t(($) => $.auth.account)}
                </h1>
                <p className="text-muted-foreground">{t(($) => $.auth.accountDescription)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {account.platform_scope?.organizations === true && (
                  <LinkButton
                    href="/platform"
                    variant="outline"
                    isDisabled={pending || accountLocked}
                  >
                    {t(($) => $.platform.title)}
                  </LinkButton>
                )}
                <Button
                  variant="outline"
                  isDisabled={pending || accountLocked}
                  onPress={() => void signOut()}
                >
                  {t(($) => $.auth.signout)}
                </Button>
              </div>
            </header>
            {failed && (
              <Alert variant="destructive">
                <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
              </Alert>
            )}
            {waitingForEntry ? (
              loading ? (
                <div role="status" className="grid max-w-xl gap-3">
                  <span>{t(($) => $.workspace.entry.loading)}</span>
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription className="flex flex-wrap items-center gap-2">
                    {t(($) => $.auth.readError)}
                    <Button variant="outline" onPress={() => chooseOrganization()}>
                      {t(($) => $.workspace.entry.back)}
                    </Button>
                  </AlertDescription>
                </Alert>
              )
            ) : showEntry ? (
              <WorkspaceEntry
                key={needsOrganization ? "organization" : organizationId}
                step={needsOrganization ? "organization" : "center"}
                options={
                  needsOrganization
                    ? organizations.map((organization) => ({
                        id: organization.id,
                        name: organization.name,
                        disabled:
                          organization.state !== "active" || organization.access_mode === "closed",
                      }))
                    : activeCenters
                }
                onChoose={(id) => {
                  if (needsOrganization) {
                    chooseOrganization(id);
                    accountHeading.current?.focus();
                  } else {
                    setCenterChoice(id);
                    continueToAccount();
                  }
                }}
                onBack={
                  needsCenter && organizations.length > 1 ? () => chooseOrganization() : undefined
                }
                onAccount={continueToAccount}
              />
            ) : (
              <>
                {workspace && organizations.length === 0 && (
                  <section aria-labelledby="workspace-no-access" className="space-y-1">
                    <h2 id="workspace-no-access" className="font-semibold">
                      {t(($) => $.workspace.entry.noAccess)}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t(($) => $.workspace.entry.noAccessHint)}
                    </p>
                  </section>
                )}
                {setupPanel(organizationId, centerId, workspace)}
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
                    {organizationId &&
                      centerId &&
                      hasWorkspaceManagementScope(workspace, centerId) && (
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
              </>
            )}
          </div>
        );
      }}
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
