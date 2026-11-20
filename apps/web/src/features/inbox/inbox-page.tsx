import { useCallback, useState } from "react";
import { useLoaderData, useSearch, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AccountView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { getSupabaseClient } from "../../lib/supabase";
import { useAccountAppearance } from "../account/use-account-appearance";
import { readWorkspace } from "../workspace/workspace";
import { WorkspaceLayout, type WorkspaceSelection } from "../workspace/workspace-layout";
import { InboxContent } from "./inbox-content";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { MemberLayout } from "../member/member-layout";
export function InboxRoutePage() {
  const account = useLoaderData({ from: "/inbox" }),
    search = useSearch({ from: "/inbox" });
  if (search.view === "member")
    return (
      <MemberInboxPage
        key={`${account.id}:${search.org ?? ""}:${search.center ?? ""}`}
        account={account}
        initial={search}
      />
    );
  return (
    <InboxPage
      key={`${account.id}:${search.org ?? ""}:${search.center ?? ""}`}
      account={account}
      initial={search}
    />
  );
}
function MemberInboxPage({
  account,
  initial,
}: {
  account: AccountView;
  initial: { org?: string; center?: string };
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const onScope = useCallback(
    (selection: { org?: string; center?: string }) => {
      void navigate({ to: "/inbox", search: { ...selection, view: "member" }, replace: true });
    },
    [navigate],
  );
  return (
    <MemberLayout
      account={account}
      initial={initial}
      title={t(($) => $.workspace.notifications)}
      active="inbox"
      onScope={onScope}
    >
      {({ scope, timezone, personId, onLockChange }) => (
        <div className="mx-auto max-w-5xl p-4">
          <InboxContent
            scope={scope}
            timezone={timezone}
            memberPersonId={personId}
            onLockChange={onLockChange}
          />
        </div>
      )}
    </MemberLayout>
  );
}
function InboxPage({
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
  useAccountAppearance(account.id);
  const [organizationId, setOrganization] = useState(initial.org),
    [centerId, setCenter] = useState(initial.center),
    [locked, setLocked] = useState(false),
    [signingOut, setSigningOut] = useState(false),
    [signOutError, setSignOutError] = useState(false);
  const resolve = useCallback(
    (selection: WorkspaceSelection) => {
      if (
        !locked &&
        selection.organizationId &&
        selection.centerId &&
        (selection.organizationId !== initial.org || selection.centerId !== initial.center)
      )
        void navigate({
          to: "/inbox",
          search: { org: selection.organizationId, center: selection.centerId },
          replace: true,
        });
    },
    [locked, navigate, initial.org, initial.center],
  );
  async function signOut() {
    if (locked || signingOut) return;
    setSigningOut(true);
    setSignOutError(false);
    const result = await getSupabaseClient().auth.signOut({ scope: "local" });
    if (result.error) {
      setSignOutError(true);
      setSigningOut(false);
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
      pageTitle={t(($) => $.inbox.title)}
      scopeControl={{
        organizationId,
        centerId,
        locked,
        onOrganization: (id) => {
          setOrganization(id);
          setCenter(undefined);
        },
        onCenter: setCenter,
        onResolved: resolve,
      }}
    >
      {(selection) => (
        <>
          {signOutError && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
            </Alert>
          )}
          {initial.org &&
          initial.center &&
          (locked ||
            (selection.organizationId === initial.org && selection.centerId === initial.center)) ? (
            <ScopedInbox
              key={`${account.id}:${initial.org}:${initial.center}`}
              scope={{ accountId: account.id, orgId: initial.org, centerId: initial.center }}
              onLockChange={setLocked}
              preservePending={locked}
            />
          ) : (
            <div>
              <h1 className="text-2xl font-semibold">{t(($) => $.inbox.title)}</h1>
              <p className="mt-3 text-muted-foreground">{t(($) => $.studio.chooseScope)}</p>
            </div>
          )}
        </>
      )}
    </WorkspaceLayout>
  );
}
function ScopedInbox({
  scope,
  onLockChange,
  preservePending,
}: {
  scope: ClientScope;
  onLockChange: (value: boolean) => void;
  preservePending: boolean;
}) {
  const { t } = useTranslation();
  const workspace = useQuery({
    queryKey: ["workspace", scope.accountId, scope.orgId],
    queryFn: () => readWorkspace(scope.accountId, scope.orgId),
    enabled: false,
    retry: false,
  });
  const center =
    (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
      ? workspace.data.centers.find((row) => row.id === scope.centerId && row.accessible)
      : undefined;
  return center ? (
    <InboxContent scope={scope} timezone={center.timezone} onLockChange={onLockChange} />
  ) : (
    <div>
      <h1 className="text-2xl font-semibold">{t(($) => $.inbox.title)}</h1>
      <p>{t(($) => $.studio.chooseScope)}</p>
    </div>
  );
}
