import { useCallback, useState } from "react";
import { useLoaderData, useSearch, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout, type WorkspaceSelection } from "../workspace/workspace-layout";
import { useAccountAppearance } from "../account/use-account-appearance";
import { getSupabaseClient } from "../../lib/supabase";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { InstructorTodayContent } from "./instructor-today-content";
import type { AccountView } from "../../lib/api-contracts/generated";
export function InstructorTodayRoutePage() {
  const account = useLoaderData({ from: "/instructor/today" });
  const search = useSearch({ from: "/instructor/today" });
  return (
    <InstructorTodayPage
      key={`${account.id}:${search.org ?? ""}:${search.center ?? ""}`}
      account={account}
      initial={search}
    />
  );
}
function InstructorTodayPage({
  account,
  initial,
}: {
  account: AccountView;
  initial: { org?: string; center?: string };
}) {
  const { t } = useTranslation(),
    navigate = useNavigate(),
    router = useRouter(),
    queries = useQueryClient();
  const appearance = useAccountAppearance(account.id);
  const [organizationId, setOrganizationId] = useState(initial.org);
  const [centerId, setCenterId] = useState(initial.center);
  const [signingOut, setSigningOut] = useState(false),
    [signOutFailed, setSignOutFailed] = useState(false);
  const resolveScope = useCallback(
    (selection: WorkspaceSelection) => {
      if (!selection.organizationId || !selection.centerId || signingOut) return;
      if (selection.organizationId !== initial.org || selection.centerId !== initial.center)
        void navigate({
          to: "/instructor/today",
          search: { org: selection.organizationId, center: selection.centerId },
          replace: true,
        });
    },
    [initial.org, initial.center, signingOut, navigate],
  );
  async function signOut() {
    if (signingOut) return;
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
      pending={signingOut}
      onSignOut={() => {
        void signOut();
      }}
      pageTitle={t(($) => $.instructorToday.title)}
      scopeControl={{
        organizationId,
        centerId,
        locked: signingOut,
        onOrganization: (id) => {
          setOrganizationId(id);
          setCenterId(undefined);
        },
        onCenter: setCenterId,
        onResolved: resolveScope,
      }}
    >
      {(selection) => (
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
            <InstructorTodayContent
              key={`${account.id}:${selection.organizationId}:${selection.centerId}`}
              scope={{
                accountId: account.id,
                orgId: selection.organizationId,
                centerId: selection.centerId,
              }}
              weekStart={appearance.isError ? undefined : appearance.data?.values.week_start}
            />
          ) : (
            <div className="p-6">
              <h1 className="text-2xl font-semibold">{t(($) => $.instructorToday.title)}</h1>
              <p className="mt-3 text-muted-foreground">
                {t(($) => $.instructorToday.chooseScope)}
              </p>
            </div>
          )}
        </>
      )}
    </WorkspaceLayout>
  );
}
