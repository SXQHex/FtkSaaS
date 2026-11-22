import { useCallback, useEffect, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { readPeopleCenter } from "../people/people";
import { PersonEntry } from "../people/person-entry";
import { AccessActionController } from "./access-controller";
import { accessKeys, invalidateAccessDirectories } from "./access-query";
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
    ...accessKeys.invitations(scope),
    invitationFilter,
    timezone,
    cursor,
  ];
  const accountKey = (cursor?: string) => [
    ...accessKeys.accounts(scope),
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
    // Native receipt/action readback has completed before this callback.
    // Cancel older in-flight reads and mark every filter/cursor variant stale.
    await invalidateAccessDirectories(queries, scope);

    // Both directories must be attempted independently. Retrying a previously
    // denied directory permits recovery if access has since been restored.
    const [invitationResult, accountResult] = await Promise.allSettled([
      queries.fetchQuery({
        queryKey: invitationKey(),
        queryFn: () => readInvitations(),
        staleTime: 0,
        retry: false,
      }),
      queries.fetchQuery({
        queryKey: accountKey(),
        queryFn: () => readAccounts(),
        staleTime: 0,
        retry: false,
      }),
    ]);

    // Even on FORBIDDEN, show the failing first-page query instead of the last
    // authorized cursor page. AccessView renders query errors, never empty success.
    setInvitationCursors([undefined]);
    setInvitationIndex(0);
    setAccountCursors([undefined]);
    setAccountIndex(0);

    const forbidden = (error: unknown) =>
      error instanceof BackendError && error.code === "FORBIDDEN";
    for (const result of [invitationResult, accountResult]) {
      if (result.status === "rejected" && !forbidden(result.reason)) throw result.reason;
    }
    if (invitationResult.status !== "fulfilled" && accountResult.status !== "fulfilled")
      throw new Error("ACCESS_DIRECTORY_UNAVAILABLE");
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
          // Query errors remain visible if this manual retry fails. Do not
          // refetch a stale cursor or let one FORBIDDEN block the other reader.
          void Promise.allSettled([refresh(), center.refetch()]);
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
          onInvitationReadback={refresh}
        />
      )}
    </>
  );
}
