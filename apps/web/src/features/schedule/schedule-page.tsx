import { useCallback, useState } from "react";
import {
  useLoaderData,
  useParams,
  useSearch,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout, type WorkspaceSelection } from "../workspace/workspace-layout";
import { useAccountAppearance } from "../account/use-account-appearance";
import { getSupabaseClient } from "../../lib/supabase";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { ScheduleContent } from "./schedule-content";
import type { SchedulePanelMode } from "./schedule-session-sheet";
import type { AccountView } from "@ftksaas/api-contracts";

export function ScheduleRoutePage() {
  const account = useLoaderData({ from: "/o/$orgId/c/$centerId/schedule" });
  const search = useSearch({ from: "/o/$orgId/c/$centerId/schedule" });
  const { orgId, centerId } = useParams({ from: "/o/$orgId/c/$centerId/schedule" });
  return (
    <SchedulePage
      key={`${account.id}:${orgId}:${centerId}:${search.session ?? ""}:${search.action ?? "view"}:${search.create ?? false}`}
      initialCreate={search.create}
      initialSession={search.session}
      initialMode={search.action ?? "view"}
      account={account}
      orgId={orgId}
      centerId={centerId}
    />
  );
}
function SchedulePage({
  account,
  orgId,
  centerId,
  initialSession,
  initialMode,
  initialCreate,
}: {
  account: AccountView;
  orgId: string;
  centerId: string;
  initialSession?: string;
  initialCreate?: boolean;
  initialMode: SchedulePanelMode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const queries = useQueryClient();
  const appearance = useAccountAppearance(account.id);
  const firstDay = !appearance.isError && appearance.data?.values.week_start === "sunday" ? 0 : 1;
  const [organizationId, setOrganizationId] = useState(orgId);
  const [selectedCenterId, setCenterId] = useState<string | undefined>(centerId);
  const [locked, setLocked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const resolveScope = useCallback(
    (selection: WorkspaceSelection) => {
      if (locked || !selection.organizationId || !selection.centerId) return;
      if (selection.organizationId !== orgId || selection.centerId !== centerId)
        void navigate({
          to: "/o/$orgId/c/$centerId/schedule",
          params: { orgId: selection.organizationId, centerId: selection.centerId },
          replace: true,
          search: {},
        });
    },
    [locked, orgId, centerId, navigate],
  );
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
      pageTitle={t(($) => $.schedule.title)}
      scopeControl={{
        organizationId,
        centerId: selectedCenterId,
        locked,
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
          {selection.organizationId && selection.centerId ? (
            <ScheduleContent
              key={`${account.id}:${selection.organizationId}:${selection.centerId}`}
              scope={{
                accountId: account.id,
                orgId: selection.organizationId,
                centerId: selection.centerId,
              }}
              initialCreate={initialCreate}
              initialSession={initialSession}
              initialMode={initialMode}
              firstDay={firstDay}
              onLockChange={setLocked}
            />
          ) : (
            <div className="p-6">
              <h1 className="text-2xl font-semibold">{t(($) => $.schedule.title)}</h1>
              <p className="mt-3 text-muted-foreground">{t(($) => $.studio.chooseScope)}</p>
            </div>
          )}
        </>
      )}
    </WorkspaceLayout>
  );
}
