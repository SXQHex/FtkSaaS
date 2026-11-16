import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout, type WorkspaceSelection } from "../workspace/workspace-layout";
import { useAccountAppearance } from "../account/use-account-appearance";
import { getSupabaseClient } from "../../lib/supabase";
import { Alert, AlertDescription } from "../../components/ui/alert";
import type { AccountView } from "../../lib/api-contracts/generated";
import type { ClientScope } from "../../lib/scoped-backend";
export function InstructorLayout({
  account,
  initial,
  title,
  onScope,
  children,
}: {
  account: AccountView;
  initial: { org?: string; center?: string };
  title: string;
  onScope: (selection: WorkspaceSelection) => void;
  children: (context: {
    scope: ClientScope;
    weekStart?: "monday" | "sunday";
    onLockChange: (value: boolean) => void;
    preservePending: boolean;
  }) => ReactNode;
}) {
  const { t } = useTranslation(),
    navigate = useNavigate(),
    router = useRouter(),
    queries = useQueryClient();
  const appearance = useAccountAppearance(account.id);
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Fethiye Tango`;
    return () => {
      document.title = previous;
    };
  }, [title]);
  const [organizationId, setOrganizationId] = useState(initial.org),
    [centerId, setCenterId] = useState(initial.center);
  const [locked, setLocked] = useState(false),
    [signingOut, setSigningOut] = useState(false),
    [signOutFailed, setSignOutFailed] = useState(false);
  async function signOut() {
    if (locked || signingOut) return;
    setSigningOut(true);
    setSignOutFailed(false);
    const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
    if (error) {
      setSigningOut(false);
      setSignOutFailed(true);
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
      pending={locked || signingOut}
      onSignOut={() => {
        void signOut();
      }}
      pageTitle={title}
      scopeControl={{
        organizationId,
        centerId,
        locked: locked || signingOut,
        onOrganization: (id) => {
          setOrganizationId(id);
          setCenterId(undefined);
        },
        onCenter: setCenterId,
        onResolved: onScope,
      }}
    >
      {(resolved) => {
        const selection = locked
          ? { organizationId: initial.org, centerId: initial.center }
          : resolved;
        return (
          <>
            {signOutFailed && (
              <Alert variant="destructive">
                <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
              </Alert>
            )}
            {selection.organizationId &&
            selection.centerId &&
            selection.organizationId === initial.org &&
            selection.centerId === initial.center ? (
              children({
                scope: {
                  accountId: account.id,
                  orgId: selection.organizationId,
                  centerId: selection.centerId,
                },
                weekStart: appearance.isError ? undefined : appearance.data?.values.week_start,
                onLockChange: setLocked,
                preservePending: locked,
              })
            ) : (
              <div className="p-6">
                <h1 className="text-2xl font-semibold">{title}</h1>
                <p className="mt-3 text-muted-foreground">
                  {t(($) => $.instructorToday.chooseScope)}
                </p>
              </div>
            )}
          </>
        );
      }}
    </WorkspaceLayout>
  );
}
