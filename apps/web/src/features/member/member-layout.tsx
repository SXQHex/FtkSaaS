import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  CalendarDaysIcon,
  CheckIcon,
  WalletIcon,
  SparklesIcon,
  UserIcon,
  MoonIcon,
} from "lucide-react";
import type { AccountView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { getSupabaseClient } from "../../lib/supabase";
import { BackendError } from "../../lib/backend";
import { workspaceQuery } from "../workspace/workspace-query";
import { useAccountAppearance } from "../account/use-account-appearance";
import { MemberShellView } from "./member-shell-view";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { MemberInboxLink } from "../inbox/member-inbox-link";
export function MemberLayout({
  account,
  initial,
  title,
  active,
  onScope,
  children,
}: {
  account: AccountView;
  initial: { org?: string; center?: string };
  title: string;
  active: "classes" | "reservations" | "entitlements" | "requests" | "account" | "inbox";
  onScope: (selection: { org?: string; center?: string }) => void;
  children: (context: {
    scope: ClientScope;
    personId: string;
    timezone: string;
    weekStart: "monday" | "sunday" | null;
    onLockChange: (locked: boolean) => void;
  }) => ReactNode;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    navigate = useNavigate(),
    queries = useQueryClient();
  const [locked, setLocked] = useState(false),
    [signingOut, setSigningOut] = useState(false),
    [signOutError, setSignOutError] = useState(false);
  const appearance = useAccountAppearance(account.id);
  const workspace = useQuery(workspaceQuery(queries, account.id, initial.org));
  const source = !workspace.isError || locked ? workspace.data : undefined;
  const org = source?.selected;
  const center = initial.center
    ? source?.centers.find((row) => row.id === initial.center && row.accessible)
    : source?.centers.length === 1
      ? source.centers[0]
      : undefined;
  const self = org?.self_context;
  const student = self?.centers.some((row) => row.center_id === center?.id && row.student);
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Fethiye Tango`;
    return () => {
      document.title = previous;
    };
  }, [title]);
  useEffect(() => {
    if (!locked && org && center && (org.id !== initial.org || center.id !== initial.center))
      onScope({ org: org.id, center: center.id });
  }, [org, center, initial.org, initial.center, locked, onScope]);
  useEffect(() => {
    const error = workspace.error;
    if (
      (error instanceof BackendError &&
        ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
      (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
    )
      void router.invalidate();
  }, [workspace.error, router]);
  const links = (
    [
      { id: "classes", icon: <CalendarDaysIcon /> },
      { id: "reservations", icon: <CheckIcon /> },
      { id: "entitlements", icon: <WalletIcon /> },
      { id: "requests", icon: <SparklesIcon /> },
      { id: "account", icon: <UserIcon /> },
    ] as const
  ).map((link) => ({
    ...link,
    label: t(($) => $.memberReservations.links[link.id]),
    current: link.id === active,
    href:
      (link.id === "classes" ||
        link.id === "account" ||
        link.id === "reservations" ||
        link.id === "entitlements" ||
        link.id === "requests") &&
      org &&
      center
        ? `/member/${link.id === "requests" ? "private-lessons" : link.id}?${new URLSearchParams({ org: org.id, center: center.id })}`
        : undefined,
  }));
  async function signOut() {
    if (locked || signingOut) return;
    setSigningOut(true);
    setSignOutError(false);
    const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
    if (error) {
      setSignOutError(true);
      setSigningOut(false);
      return;
    }
    queries.clear();
    await navigate({ to: "/login", replace: true });
    await router.invalidate();
  }
  return (
    <MemberShellView
      brand={org?.name ?? t(($) => $.app.title)}
      subtitle={center?.name ?? t(($) => $.memberReservations.shell)}
      navigationLabel={t(($) => $.memberReservations.navigation)}
      links={links}
      linksDisabled={locked || signingOut}
      actions={
        <div className="flex flex-wrap gap-2">
          {org && center && student && (
            <MemberInboxLink
              scope={{ accountId: account.id, orgId: org.id, centerId: center.id }}
              current={active === "inbox"}
              disabled={locked || signingOut}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t(($) => $.workspace.changeTheme)}
            onPress={() => {
              document.documentElement.dataset.theme =
                document.documentElement.dataset.theme === "dark" ? "light" : "dark";
            }}
          >
            <MoonIcon aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            isDisabled={locked || signingOut}
            onPress={() => {
              void signOut();
            }}
          >
            {t(($) => $.auth.signout)}
          </Button>
        </div>
      }
    >
      <div className="mx-auto flex max-w-5xl flex-wrap gap-3 px-4 pt-4">
        <NativeSelect
          aria-label={t(($) => $.memberReservations.chooseOrg)}
          className="w-full sm:w-56"
          value={org?.id ?? ""}
          disabled={locked || signingOut || workspace.isFetching}
          onChange={(event) => onScope({ org: event.target.value || undefined })}
        >
          <NativeSelectOption value="">
            {t(($) => $.workspace.chooseOrganization)}
          </NativeSelectOption>
          {source?.organizations.map((row) => (
            <NativeSelectOption key={row.id} value={row.id}>
              {row.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t(($) => $.memberReservations.chooseCenter)}
          className="w-full sm:w-56"
          value={center?.id ?? ""}
          disabled={locked || signingOut || workspace.isFetching || !org}
          onChange={(event) => onScope({ org: org?.id, center: event.target.value || undefined })}
        >
          <NativeSelectOption value="">{t(($) => $.workspace.chooseCenter)}</NativeSelectOption>
          {source?.centers.map((row) => (
            <NativeSelectOption key={row.id} value={row.id}>
              {row.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {signOutError && (
        <Alert variant="destructive">
          <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
        </Alert>
      )}
      {org &&
      center &&
      self?.person_id &&
      student &&
      initial.org === org.id &&
      initial.center === center.id ? (
        children({
          scope: { accountId: account.id, orgId: org.id, centerId: center.id },
          personId: self.person_id,
          timezone: center.timezone,
          weekStart: appearance.isPending
            ? null
            : ((appearance.isError ? undefined : appearance.data?.values.week_start) ?? "monday"),
          onLockChange: setLocked,
        })
      ) : (
        <div className="space-y-4 p-6">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p role="status">
            {workspace.isPending
              ? t(($) => $.memberReservations.loading)
              : workspace.isError
                ? t(($) => $.workspace.readFailed)
                : !org || !center
                  ? t(($) => $.memberReservations.noScope)
                  : t(($) => $.memberReservations.unavailable)}
          </p>
          {workspace.isError && (
            <Button
              variant="outline"
              onPress={() => {
                void workspace.refetch();
              }}
            >
              {t(($) => $.memberReservations.retry)}
            </Button>
          )}
        </div>
      )}
    </MemberShellView>
  );
}
