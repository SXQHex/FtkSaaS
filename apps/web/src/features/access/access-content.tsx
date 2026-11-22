import { useCallback, useEffect, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { readPeopleCenter } from "../people/people";
import { PersonEntry } from "../people/person-entry";
import { AccessActionController } from "./access-controller";
import { invalidateAccessDirectories } from "./access-query";
import {
  AccessView,
  type AccessAction,
  type InvitationFilter,
  type AccountFilter,
} from "./access-view";
import {
  readInvitationDirectory,
  readAccountDirectory,
  invitationDirectoryRows,
  accountDirectoryRows,
  directorySummary,
} from "./access-directory";

export function AccessContent({
  scope,
  onLockChange,
}: {
  scope: ClientScope;
  onLockChange: (value: boolean) => void;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queries = useQueryClient();
  const [invitationFilter, setInvitationFilter] = useState<InvitationFilter>("open");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [search, setSearch] = useState("");
  const [queryText, setQueryText] = useState("");
  const [invitationCursors, setInvitationCursors] = useState<(string | undefined)[]>([undefined]);
  const [accountCursors, setAccountCursors] = useState<(string | undefined)[]>([undefined]);
  const [invitationIndex, setInvitationIndex] = useState(0);
  const [accountIndex, setAccountIndex] = useState(0);
  const [selection, setSelection] = useState<AccessAction>();
  const [locked, setLocked] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryGeneration, setEntryGeneration] = useState(0);
  const center = useQuery({
    queryKey: ["access-center", scope.accountId, scope.orgId, scope.centerId],
    queryFn: () => readPeopleCenter(scope),
    retry: false,
  });
  const timezone = center.data?.timezone;
  const invitationKey = (cursor?: string) => [
    "access-invitations",
    scope.accountId,
    scope.orgId,
    scope.centerId,
    invitationFilter,
    timezone,
    cursor,
  ];
  const accountKey = (cursor?: string) => [
    "access-accounts",
    scope.accountId,
    scope.orgId,
    scope.centerId,
    accountFilter,
    queryText,
    cursor,
  ];
  const readInvitations = async (cursor?: string) => {
    const page = await readInvitationDirectory(scope, invitationFilter, cursor);
    return { page, rows: invitationDirectoryRows(page, scope.centerId, timezone) };
  };
  const readAccounts = async (cursor?: string) => {
    const page = await readAccountDirectory(scope, accountFilter, queryText, cursor);
    return { page, rows: accountDirectoryRows(page) };
  };
  const invitations = useQuery({
    queryKey: invitationKey(invitationCursors[invitationIndex]),
    queryFn: () => readInvitations(invitationCursors[invitationIndex]),
    enabled: !center.isPending,
    retry: false,
  });
  const accounts = useQuery({
    queryKey: accountKey(accountCursors[accountIndex]),
    queryFn: () => readAccounts(accountCursors[accountIndex]),
    retry: false,
  });
  const publishLock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  const accessLost = useCallback(() => {
    setSelection(undefined);
    setEntryOpen(false);
    queries.clear();
    void navigate({ to: "/account", replace: true }).then(() => router.invalidate());
  }, [queries, navigate, router]);
  const nativeAccessLost = [center.error, invitations.error, accounts.error].some((error) => {
    const code =
      error instanceof BackendError
        ? error.code
        : error instanceof Error
          ? error.message
          : undefined;
    return code && ["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED"].includes(code);
  });
  useEffect(() => {
    if (!nativeAccessLost) return;
    queries.clear();
    void navigate({ to: "/account", replace: true }).then(() => router.invalidate());
  }, [nativeAccessLost, queries, navigate, router]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQueryText(search.trim());
      setAccountCursors([undefined]);
      setAccountIndex(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  async function refresh() {
    // Native receipt/action readback has completed before this callback. Stale
    // cursor variants must not be trusted when returning from another page.
    await invalidateAccessDirectories(queries, scope);
    const alreadyRestricted = (error: unknown) =>
      error instanceof BackendError && error.code === "FORBIDDEN";
    const invitationDenied = alreadyRestricted(invitations.error);
    const accountDenied = alreadyRestricted(accounts.error);
    // Denial on one directory must not prevent the other from rereading its
    // first page. All requests settle before propagating non-permission errors.
    const [invitationResult, accountResult] = await Promise.allSettled([
      invitationDenied
        ? Promise.resolve()
        : queries.fetchQuery({
            queryKey: invitationKey(),
            queryFn: () => readInvitations(),
            staleTime: 0,
          }),
      accountDenied
        ? Promise.resolve()
        : queries.fetchQuery({
            queryKey: accountKey(),
            queryFn: () => readAccounts(),
            staleTime: 0,
          }),
    ]);
    // Keep an already denied directory on its failing query, rather than
    // exposing an old, successful first-page cache as though it were permitted.
    if (!invitationDenied) {
      setInvitationCursors([undefined]);
      setInvitationIndex(0);
    }
    if (!accountDenied) {
      setAccountCursors([undefined]);
      setAccountIndex(0);
    }
    for (const result of [invitationResult, accountResult]) {
      if (result.status === "rejected" && !alreadyRestricted(result.reason)) throw result.reason;
    }
    const refreshed =
      (!invitationDenied && invitationResult.status === "fulfilled") ||
      (!accountDenied && accountResult.status === "fulfilled");
    if (!refreshed) throw new Error("ACCESS_DIRECTORY_UNAVAILABLE");
  }
  const invitationState = invitations.isError
    ? "error"
    : invitations.isPending || invitations.isFetching
      ? "loading"
      : "ready";
  const accountState = accounts.isError
    ? "error"
    : accounts.isPending || accounts.isFetching || search.trim() !== queryText
      ? "loading"
      : "ready";
  if (nativeAccessLost) return null;
  return (
    <>
      <AccessView
        invitations={invitations.data?.rows ?? []}
        accounts={accounts.data?.rows ?? []}
        summary={directorySummary(
          invitationState === "ready" ? invitations.data?.page : undefined,
          accountState === "ready" ? accounts.data?.page : undefined,
        )}
        state={invitationState === "error" || accountState === "error" ? "error" : "ready"}
        invitationState={invitationState}
        accountState={accountState}
        invitationFilter={invitationFilter}
        accountFilter={accountFilter}
        search={search}
        locked={locked || Boolean(selection) || entryOpen}
        onInvitationFilter={(value) => {
          if (!locked) {
            setInvitationFilter(value);
            setInvitationCursors([undefined]);
            setInvitationIndex(0);
          }
        }}
        onAccountFilter={(value) => {
          if (!locked) {
            setAccountFilter(value);
            setAccountCursors([undefined]);
            setAccountIndex(0);
          }
        }}
        onSearch={(value) => {
          if (!locked) setSearch(value);
        }}
        onBack={() => {
          void navigate({
            to: "/o/$orgId/c/$centerId/people",
            params: { orgId: scope.orgId, centerId: scope.centerId },
          });
        }}
        onRetry={() => {
          setInvitationCursors([undefined]);
          setInvitationIndex(0);
          setAccountCursors([undefined]);
          setAccountIndex(0);
          void queries.invalidateQueries({
            queryKey: ["access-invitations", scope.accountId, scope.orgId, scope.centerId],
          });
          void queries.invalidateQueries({
            queryKey: ["access-accounts", scope.accountId, scope.orgId, scope.centerId],
          });
          void center.refetch();
        }}
        onAction={setSelection}
        onInvite={() => {
          setEntryGeneration((value) => value + 1);
          setEntryOpen(true);
        }}
        invitationPaging={{
          busy: invitationState !== "ready",
          hasPrevious: invitationIndex > 0,
          hasNext: Boolean(invitations.data?.page.next_cursor),
          onPrevious: () => setInvitationIndex((value) => Math.max(0, value - 1)),
          onNext: () => {
            const cursor = invitations.data?.page.next_cursor;
            if (cursor) {
              setInvitationCursors((value) => [...value.slice(0, invitationIndex + 1), cursor]);
              setInvitationIndex((value) => value + 1);
            }
          },
        }}
        accountPaging={{
          busy: accountState !== "ready",
          hasPrevious: accountIndex > 0,
          hasNext: Boolean(accounts.data?.page.next_cursor),
          onPrevious: () => setAccountIndex((value) => Math.max(0, value - 1)),
          onNext: () => {
            const cursor = accounts.data?.page.next_cursor;
            if (cursor) {
              setAccountCursors((value) => [...value.slice(0, accountIndex + 1), cursor]);
              setAccountIndex((value) => value + 1);
            }
          },
        }}
      />
      {selection && (
        <AccessActionController
          scope={scope}
          selection={selection}
          onClose={() => setSelection(undefined)}
          onLockChange={publishLock}
          onRefresh={refresh}
          onAccessLost={accessLost}
        />
      )}
      {entryOpen && (
        <PersonEntry
          key={entryGeneration}
          scope={scope}
          open
          onClose={() => setEntryOpen(false)}
          onLockChange={publishLock}
          onCreated={refresh}
        />
      )}
    </>
  );
}
