import { useCallback, useEffect, useState } from "react";
import {
  useLoaderData,
  useParams,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout, type WorkspaceSelection } from "../workspace/workspace-layout";
import { useAccountAppearance } from "../account/use-account-appearance";
import { getSupabaseClient } from "../../lib/supabase";
import { BackendError } from "../../lib/backend";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { PeopleView, type PeopleFilter } from "./people-view";
import { PersonEntry } from "./person-entry";
import { readPeoplePage, readPeopleCenter, type PeopleScope } from "./people";
import type { AccountView, PersonView } from "@ftksaas/api-contracts";

import { peopleRow } from "./people-summary";
import { readMergeDirectory } from "./merge-directory";

export function PeopleRoutePage() {
  const account = useLoaderData({ from: "/o/$orgId/c/$centerId/people" });
  const { orgId, centerId } = useParams({ from: "/o/$orgId/c/$centerId/people" });
  return (
    <PeoplePage
      key={`${account.id}:${orgId}:${centerId}`}
      account={account}
      orgId={orgId}
      centerId={centerId}
    />
  );
}
function PeoplePage({
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
  const [locked, setLocked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const resolveScope = useCallback(
    (selection: WorkspaceSelection) => {
      if (locked || !selection.organizationId || !selection.centerId) return;
      if (selection.organizationId !== orgId || selection.centerId !== centerId)
        void navigate({
          to: "/o/$orgId/c/$centerId/people",
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
      pageTitle={t(($) => $.people.title)}
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
            <PeopleContent
              key={`${account.id}:${selection.organizationId}:${selection.centerId}`}
              scope={{
                accountId: account.id,
                orgId: selection.organizationId,
                centerId: selection.centerId,
              }}
              onLockChange={setLocked}
            />
          ) : (
            <div className="p-6">
              <h1 className="text-2xl font-semibold">{t(($) => $.people.title)}</h1>
              <p className="mt-3 text-muted-foreground">{t(($) => $.studio.chooseScope)}</p>
            </div>
          )}
        </>
      )}
    </WorkspaceLayout>
  );
}
function PeopleContent({
  scope,
  onLockChange,
}: {
  scope: PeopleScope;
  onLockChange: (value: boolean) => void;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const { orgId, centerId } = useParams({ from: "/o/$orgId/c/$centerId/people" });
  const { action } = useSearch({ from: "/o/$orgId/c/$centerId/people" });
  const inviteRequested =
    action === "invite" && scope.orgId === orgId && scope.centerId === centerId;
  const { t } = useTranslation();
  const [filter, setFilter] = useState<PeopleFilter>("all");
  const [search, setSearch] = useState("");
  const [queryText, setQueryText] = useState("");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const [locked, setLocked] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryStarted, setEntryStarted] = useState(false);
  const [entryGeneration, setEntryGeneration] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQueryText(search.trim());
      setCursors([undefined]);
      setIndex(0);
      setSelectedId(undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: [
      "people",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      queryText,
      "with-member-summary",
      filter,
      cursors[index],
    ],
    queryFn: () =>
      readPeoplePage(scope, queryText, cursors[index], filter === "all" ? undefined : filter, true),
    retry: false,
  });
  const center = useQuery({
    queryKey: ["people-center", scope.accountId, scope.orgId, scope.centerId],
    queryFn: () => readPeopleCenter(scope),
    retry: false,
  });
  const mergeCount = useQuery({
    queryKey: ["merge-directory", scope.accountId, scope.orgId, scope.centerId, "suggestion-count"],
    queryFn: async () =>
      (await readMergeDirectory(scope, "suggested", "", undefined, 1)).summary.filtered,
    retry: false,
  });
  useEffect(() => {
    for (const error of [query.error, center.error, mergeCount.error]) {
      const code =
        error instanceof BackendError
          ? error.code
          : error instanceof Error
            ? error.message
            : undefined;
      if (code && ["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED"].includes(code)) {
        void router.invalidate();
        return;
      }
    }
  }, [query.error, center.error, mergeCount.error, router]);
  const publishLock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  const created = useCallback(
    async (person: PersonView) => {
      await query.refetch({ throwOnError: true });
      setSelectedId(person.id);
    },
    [query],
  );
  const rows = query.isError
    ? []
    : (query.data?.items ?? []).map((person) =>
        peopleRow(person, scope.centerId, t, center.data?.timezone),
      );
  return (
    <>
      <PeopleView
        rows={rows}
        state={
          query.isError
            ? "error"
            : query.isPending || query.isFetching || search.trim() !== queryText
              ? "loading"
              : "ready"
        }
        search={search}
        filter={filter}
        onFilter={(value) => {
          if (locked) return;
          setFilter(value);
          setCursors([undefined]);
          setIndex(0);
          setSelectedId(undefined);
        }}
        onSearch={(value) => {
          if (!locked) setSearch(value);
        }}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onProfile={(personId) => {
          if (!locked)
            void navigate({
              to: "/o/$orgId/c/$centerId/people/$personId",
              params: { orgId: scope.orgId, centerId: scope.centerId, personId },
            });
        }}
        activeSummary=""
        mergeCount={!mergeCount.isError && !mergeCount.isFetching ? mergeCount.data : undefined}
        hasPrevious={index > 0}
        hasNext={Boolean(query.data?.next_cursor)}
        onPrevious={() => {
          if (!locked) {
            setIndex((value) => Math.max(0, value - 1));
            setSelectedId(undefined);
          }
        }}
        onNext={() => {
          if (!locked && query.data?.next_cursor) {
            setCursors((previous) => [...previous.slice(0, index + 1), query.data.next_cursor!]);
            setIndex((value) => value + 1);
            setSelectedId(undefined);
          }
        }}
        onRetry={() => {
          void query.refetch();
        }}
        actions={{
          invitations: () => {
            if (!locked)
              void navigate({
                to: "/o/$orgId/c/$centerId/access",
                params: { orgId: scope.orgId, centerId: scope.centerId },
              });
          },
          merge: () => {
            if (!locked)
              void navigate({
                to: "/o/$orgId/c/$centerId/people/merge",
                params: { orgId: scope.orgId, centerId: scope.centerId },
              });
          },
          import: () => {
            if (!locked)
              void navigate({
                to: "/o/$orgId/c/$centerId/reports",
                params: { orgId: scope.orgId, centerId: scope.centerId },
                search: { action: "import" },
              });
          },
        }}
        onInvite={() => {
          setEntryGeneration((value) => value + 1);
          setEntryStarted(true);
          setEntryOpen(true);
        }}
        interactionLocked={locked}
      />
      {(entryStarted || inviteRequested) && (
        <PersonEntry
          key={inviteRequested ? "shortcut" : entryGeneration}
          scope={scope}
          open={entryOpen || inviteRequested}
          onClose={() => {
            setEntryOpen(false);
            if (inviteRequested)
              void navigate({ from: "/o/$orgId/c/$centerId/people", search: {}, replace: true });
          }}
          onLockChange={publishLock}
          onCreated={created}
        />
      )}
    </>
  );
}
