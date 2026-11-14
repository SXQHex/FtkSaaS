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
  async function signOut() {
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
      pending={pending}
      onSignOut={() => {
        void signOut();
      }}
      onThemeChange={
        appearanceDisabled ? undefined : () => appearanceActions.current?.toggleTheme()
      }
    >
      <div className="account-view flex min-w-0 w-full max-w-[76rem] flex-col gap-4 px-4 pt-5 pb-12 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t(($) => $.auth.account)}</h1>
            <p className="text-muted-foreground">{t(($) => $.auth.accountDescription)}</p>
          </div>
          <Button
            variant="outline"
            isDisabled={pending}
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
        <Tabs
          orientation={mobile ? "horizontal" : "vertical"}
          className="account-tabs"
          defaultSelectedKey="profile"
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
            <ProfilePanel accountId={account.id} />
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
    </WorkspaceLayout>
  );
}

export function AccountErrorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t(($) => $.auth.account)}</h1>
      <Alert variant="destructive">
        <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
      </Alert>
      <Button
        onPress={() => {
          void router.invalidate();
        }}
      >
        {t(($) => $.auth.retry)}
      </Button>
    </main>
  );
}
