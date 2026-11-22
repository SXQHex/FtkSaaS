import { useCallback, useState } from "react";
import { useParams, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAccountProjection } from "../auth/use-account-projection";
import { WorkspaceLayout, type WorkspaceSelection } from "../workspace/workspace-layout";
import { useAccountAppearance } from "../account/use-account-appearance";
import { getSupabaseClient } from "../../lib/supabase";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { OverviewContent } from "./overview-content";
import type { AccountView } from "@ftksaas/api-contracts";

export function OverviewRoutePage() {
  const account = useAccountProjection();
  const { orgId, centerId } = useParams({ from: "/o/$orgId/c/$centerId/overview" });
  return (
    <OverviewPage
      key={`${account.id}:${orgId}:${centerId}`}
      account={account}
      orgId={orgId}
      centerId={centerId}
    />
  );
}
function OverviewPage({
  account,
  orgId,
  centerId,
}: {
  account: AccountView;
  orgId: string;
  centerId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const queries = useQueryClient();
  useAccountAppearance(account.id);
  const [organizationId, setOrganizationId] = useState(orgId);
  const [selectedCenterId, setCenterId] = useState<string | undefined>(centerId);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [actionLocked, setActionLocked] = useState(false);
  const locked = signingOut || actionLocked;
  const resolveScope = useCallback(
    (selection: WorkspaceSelection) => {
      if (locked || !selection.organizationId || !selection.centerId) return;
      if (selection.organizationId !== orgId || selection.centerId !== centerId)
        void navigate({
          to: "/o/$orgId/c/$centerId/overview",
          params: { orgId: selection.organizationId, centerId: selection.centerId },
          replace: true,
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
      pageTitle={t(($) => $.overview.title)}
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
      {(resolvedSelection) => {
        const selection = locked ? { organizationId: orgId, centerId } : resolvedSelection;
        return (
          <>
            {signOutFailed && (
              <Alert variant="destructive">
                <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
              </Alert>
            )}
            {selection.organizationId && selection.centerId ? (
              <OverviewContent
                key={`${account.id}:${selection.organizationId}:${selection.centerId}`}
                onLockChange={setActionLocked}
                preservePending={actionLocked}
                scope={{
                  accountId: account.id,
                  orgId: selection.organizationId,
                  centerId: selection.centerId,
                }}
              />
            ) : (
              <div className="p-6">
                <h1 className="text-2xl font-semibold">{t(($) => $.overview.title)}</h1>
                <p className="mt-3 text-muted-foreground">{t(($) => $.studio.chooseScope)}</p>
              </div>
            )}
          </>
        );
      }}
    </WorkspaceLayout>
  );
}
