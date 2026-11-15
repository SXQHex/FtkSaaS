import { useCallback, useEffect, useState } from "react";
import { useLoaderData, useParams, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout, type WorkspaceSelection } from "../workspace/workspace-layout";
import { useAccountAppearance } from "../account/use-account-appearance";
import { getSupabaseClient } from "../../lib/supabase";
import { BackendError } from "../../lib/backend";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { PeopleView, type PeopleRow } from "./people-view";
import { PersonEntry } from "./person-entry";
import { readPeoplePage, type PeopleScope } from "./people";
import type { AccountView, PersonSummary, PersonView } from "../../lib/api-contracts/generated";

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
function row(person: PersonSummary, centerId: string): PeopleRow {
  const relationships = person.relationships.filter(
    (item) => item.center_id === centerId && item.kind === "student",
  );
  const states = new Set(relationships.map((item) => item.state));
  const state =
    states.size === 0
      ? "none"
      : states.size === 1
        ? relationships[0]?.state === "active"
          ? "active"
          : "inactive"
        : "unknown";
  return {
    id: person.id,
    name: person.display_name,
    email: person.contacts?.find((contact) => contact.kind === "email")?.value ?? null,
    state,
    entitlement: null,
    nextSession: null,
    debt: null,
  };
}
function PeopleContent({
  scope,
  onLockChange,
}: {
  scope: PeopleScope;
  onLockChange: (value: boolean) => void;
}) {
  const router = useRouter();
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
    queryKey: ["people", scope.accountId, scope.orgId, scope.centerId, queryText, cursors[index]],
    queryFn: () => readPeoplePage(scope, queryText, cursors[index]),
    retry: false,
  });
  useEffect(() => {
    const error = query.error;
    const code =
      error instanceof BackendError
        ? error.code
        : error instanceof Error
          ? error.message
          : undefined;
    if (code && ["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED"].includes(code))
      void router.invalidate();
  }, [query.error, router]);
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
    : (query.data?.items ?? []).map((person) => row(person, scope.centerId));
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
        filter="all"
        filterUnavailable
        onSearch={(value) => {
          if (!locked) setSearch(value);
        }}
        selectedId={selectedId}
        onSelect={setSelectedId}
        activeSummary=""
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
        actions={{}}
        onInvite={() => {
          setEntryGeneration((value) => value + 1);
          setEntryStarted(true);
          setEntryOpen(true);
        }}
        interactionLocked={locked}
      />
      {entryStarted && (
        <PersonEntry
          key={entryGeneration}
          scope={scope}
          open={entryOpen}
          onClose={() => setEntryOpen(false)}
          onLockChange={publishLock}
          onCreated={created}
        />
      )}
    </>
  );
}
