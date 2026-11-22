import { useWorkspaceQuery } from "../workspace/workspace-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { NotificationReadSelection, NotificationView } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { InboxView, type InboxRow } from "./inbox-view";
import { inboxKey, inboxListQuery, readNotificationState, type InboxFilter } from "./inbox";
import {
  notificationSetIntent,
  markAllNotificationsIntent,
  setNotificationsRead,
  readNotificationSetReceipt,
  readNotificationSetResult,
  type NotificationSetIntent,
  type NotificationChange,
} from "./inbox-batch";
import { readInboxSource, readMemberSessionNotice } from "./inbox-source";

import { LinkButton } from "@ftksaas/ui/components/button";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
export function InboxContent({
  scope,
  timezone,
  memberPersonId,
  onLockChange,
}: {
  scope: ClientScope;
  timezone: string;
  memberPersonId?: string;
  onLockChange: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    router = useRouter();
  const [filter, setFilter] = useState<InboxFilter>("all"),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0),
    [query, setQuery] = useState(""),
    [draftQuery, setDraftQuery] = useState(""),
    [checked, setChecked] = useState<string[]>([]),
    [undo, setUndo] = useState<{
      change: NotificationChange;
      notifications: NotificationReadSelection[];
    }>(),
    [selected, setSelected] = useState<NotificationView>(),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>();
  const pending = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const prefix = inboxKey(scope);
  const list = useQuery(inboxListQuery(scope, query, filter, cursors[index], cursors));
  const [openedSource, setOpenedSource] = useState<string>();
  const memberSessionTarget =
    memberPersonId && selected?.kind === "session_changed_for_participant"
      ? selected.work?.reservation_target
      : undefined;
  const sourceOperation = selected?.work?.selector?.operation;
  const canReadSource = Boolean(
    memberSessionTarget ||
    (sourceOperation &&
      (!memberPersonId ||
        sourceOperation === "lesson_request_create_v1" ||
        sourceOperation === "seat_offer_accept_v1")),
  );
  const nativeSource = useQuery({
    queryKey: [...prefix, "work", memberPersonId, selected?.id, selected?.work],
    queryFn: async () =>
      memberPersonId && memberSessionTarget
        ? readMemberSessionNotice(
            { ...scope, centerId: memberSessionTarget.center_id },
            memberPersonId,
            memberSessionTarget.key.session_id,
          )
        : readInboxSource(scope, selected!.work!, memberPersonId),
    enabled: canReadSource && openedSource === selected?.id,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const workspace = useWorkspaceQuery(scope.accountId, scope.orgId, false);
  const stateKey = [...prefix, "state", selected?.id];
  const source = useQuery({
    queryKey: stateKey,
    queryFn: () => readNotificationState(scope, selected!.id),
    enabled: !!selected,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const accessLost = useCallback(
    (cause: unknown) => {
      if (
        (cause instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.code)) ||
        (cause instanceof Error && ["ACCOUNT_CHANGED", "AUTH_REQUIRED"].includes(cause.message))
      ) {
        queries.removeQueries({ queryKey: ["inbox", scope.accountId] });
        void router.invalidate();
        return true;
      }
      return false;
    },
    [queries, router, scope.accountId],
  );
  useEffect(() => {
    for (const cause of [list.error, source.error, nativeSource.error])
      if (cause) accessLost(cause);
  }, [list.error, source.error, nativeSource.error, accessLost]);
  const command = useMemberCommand({
    write: setNotificationsRead,
    readReceipt: readNotificationSetReceipt,
    readResult: async (intent: NotificationSetIntent & { undoing: boolean }, id) => ({
      intent,
      rows: await readNotificationSetResult(intent, id),
    }),
    onAccessLost: accessLost,
    onRefresh: async ({ intent, rows }) => {
      if ("personId" in intent) {
        await queries.invalidateQueries({ queryKey: prefix.slice(0, 3) }, { throwOnError: true });
        setChecked([]);
        setSelected(undefined);
        setUndo(undefined);
        setCursors([undefined]);
        setIndex(0);
        return;
      }
      for (const row of rows) queries.setQueryData([...prefix, "state", row.id], row);
      await queries.invalidateQueries({ queryKey: [...prefix, "list"] }, { throwOnError: true });
      setChecked([]);
      if (typeof intent.change !== "boolean") setSelected(undefined);
      const changed = new Set(intent.changedIds);
      const exact = rows.every(
        (row, index) =>
          !changed.has(row.id) || row.version === intent.notifications[index]!.expected_version + 1,
      );
      setUndo(
        !intent.undoing && exact && changed.size
          ? {
              change:
                typeof intent.change === "boolean"
                  ? !intent.change
                  : { visibility: intent.change.from, from: intent.change.visibility },
              notifications: rows
                .filter((row) => changed.has(row.id))
                .map((row) => ({ id: row.id, expected_version: row.version })),
            }
          : undefined,
      );
    },
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  function reset() {
    if (!locked) {
      command.reset();
      setError(undefined);
      void source.refetch();
      void list.refetch();
    }
  }
  function markInboxRead() {
    if (
      !memberPersonId ||
      pending.current ||
      locked ||
      command.unavailable ||
      !["ready", "saved"].includes(command.state) ||
      list.isError ||
      !list.data
    )
      return;
    command.reset();
    setError(undefined);
    setUndo(undefined);
    void command.start({ ...markAllNotificationsIntent(scope, memberPersonId), undoing: false });
  }
  async function changeSelected(
    change: NotificationChange = true,
    target: "detail" | "selection" | "undo" = "detail",
  ) {
    if (pending.current || locked || command.unavailable) return;
    if (target === "undo") {
      if (!undo || !["ready", "saved"].includes(command.state)) return;
      command.reset();
    } else if (command.state !== "ready") return;
    pending.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const notifications =
        target === "undo"
          ? undo!.notifications
          : target === "selection"
            ? checked.map((id) => {
                const row = list.isError
                  ? undefined
                  : list.data?.items.find((item) => item.id === id);
                if (!row?.version) throw new Error("INBOX_SELECTION_UNAVAILABLE");
                return { id, expected_version: row.version };
              })
            : !source.isError && source.data
              ? [{ id: source.data.id, expected_version: source.data.version }]
              : [];
      setUndo(undefined);
      const intent = await notificationSetIntent(scope, notifications, change);
      if (mounted.current) await command.start({ ...intent, undoing: target === "undo" });
    } catch (cause) {
      if (mounted.current && !accessLost(cause))
        setError(
          cause instanceof BackendError
            ? scheduleBackendError(cause.code, t)
            : t(($) => $.inbox.readError),
        );
    } finally {
      pending.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  const format = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });
  function present(row: NotificationView): InboxRow {
    return {
      id: row.id,
      title: row.payload.title || t(($) => $.inbox.titleMissing),
      body: row.payload.body || t(($) => $.inbox.bodyMissing),
      kind: t(($) => $.inbox.notification),
      created: format.format(new Date(row.created_at)),
      language: row.payload.language,
      actionState: row.work ? t(($) => $.inbox.workStates[row.work!.state]) : undefined,
      read:
        row.id === selected?.id && !source.isError && source.data
          ? source.data.state === "read"
          : row.read_at !== null,
      context: [
        { label: t(($) => $.inbox.scope), value: t(($) => $.inbox.ownScope) },
        ...(row.email_job
          ? [
              {
                label: t(($) => $.inbox.deliveryJob),
                value: t(($) => $.inbox.jobStates[row.email_job!.state]),
              },
              {
                label: t(($) => $.inbox.emailDelivery),
                value: row.email_job.email_delivery
                  ? t(($) => $.inbox.deliveryStates[row.email_job!.email_delivery!.state])
                  : t(($) => $.inbox.unknown),
              },
            ]
          : []),
      ],
    };
  }
  return (
    <InboxView
      member={Boolean(memberPersonId)}
      loading={list.isPending}
      rows={list.isError ? null : (list.data?.items.map(present) ?? null)}
      selected={!list.isError && selected ? present(selected) : null}
      filter={filter}
      onFilter={(value) => {
        if (locked) return;
        setChecked([]);
        command.reset();
        setSelected(undefined);
        setFilter(value);
        setCursors([undefined]);
        setIndex(0);
        setError(undefined);
      }}
      query={draftQuery}
      onQuery={(value) => {
        if (!locked) setDraftQuery(value);
      }}
      onSearch={() => {
        if (locked) return;
        command.reset();
        setQuery(draftQuery.trim());
        setCursors([undefined]);
        setIndex(0);
        setSelected(undefined);
        setChecked([]);
        setError(undefined);
      }}
      advancedAvailable
      summary={!list.isError ? list.data?.summary : undefined}
      checked={checked}
      onCheck={(id, value) => {
        if (!locked) {
          command.reset();
          setChecked((previous) =>
            value ? [...new Set([...previous, id])] : previous.filter((item) => item !== id),
          );
        }
      }}
      onOpen={(id) => {
        if (!locked) {
          const row = list.data?.items.find((value) => value.id === id);
          if (row) {
            command.reset();
            setError(undefined);
            setSelected(row);
          }
        }
      }}
      onBack={() => {
        if (!locked) {
          setSelected(undefined);
          command.reset();
          setError(undefined);
        }
      }}
      onMarkRead={() => {
        void changeSelected();
      }}
      canMarkRead={!source.isError && source.data?.state === "unread" && command.state === "ready"}
      onUnread={() => {
        void changeSelected(false);
      }}
      canUnread={!source.isError && source.data?.state === "read" && command.state === "ready"}
      canMarkSelection={
        !list.isFetching && !list.isError && checked.length > 0 && command.state === "ready"
      }
      onMarkInboxRead={
        memberPersonId &&
        !list.isError &&
        list.data &&
        !list.isFetching &&
        ["ready", "saved"].includes(command.state) &&
        !command.unavailable
          ? markInboxRead
          : undefined
      }
      onMarkSelected={(read) => {
        void changeSelected(read, "selection");
      }}
      onMoveSelected={(visibility) =>
        void changeSelected(
          { visibility, from: filter === "archived" || filter === "deleted" ? filter : "inbox" },
          "selection",
        )
      }
      onSelectVisible={(value) => {
        if (locked || list.isError || list.isFetching) return;
        command.reset();
        setChecked(value ? (list.data?.items.map((row) => row.id) ?? []) : []);
      }}
      onUndo={
        undo && ["ready", "saved"].includes(command.state)
          ? () => void changeSelected(undo.change, "undo")
          : undefined
      }
      undoVisibility={undo !== undefined && typeof undo.change !== "boolean"}
      locked={locked}
      sourceAction={
        canReadSource &&
        selected && (
          <Button
            variant="outline"
            size="sm"
            isDisabled={locked || nativeSource.isFetching}
            onPress={() => {
              if (openedSource === selected.id) void nativeSource.refetch();
              else setOpenedSource(selected.id);
            }}
          >
            {t(($) => $.inbox.sourceOpen)}
          </Button>
        )
      }
      notice={
        <>
          <EventCommandNotice command={command} onReload={reset} />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}{" "}
                <Button variant="outline" size="sm" isDisabled={locked} onPress={reset}>
                  {t(($) => $.auth.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <Alert>
            <AlertDescription>
              {t(($) => $.inbox.scopeHint, { timezone })} {t(($) => $.inbox.limitHint)}
            </AlertDescription>
          </Alert>
          {list.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.inbox.readError)}{" "}
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={locked}
                  onPress={() => {
                    void list.refetch();
                  }}
                >
                  {t(($) => $.auth.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </>
      }
      detailNotice={
        <>
          {source.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.inbox.readError)}{" "}
                <Button variant="outline" size="sm" isDisabled={locked} onPress={reset}>
                  {t(($) => $.auth.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {(!canReadSource || nativeSource.isError) && (
            <p className="text-sm text-muted-foreground">{t(($) => $.inbox.sourceUnavailable)}</p>
          )}
          {nativeSource.isFetching && <p role="status">{t(($) => $.inbox.loading)}</p>}
          {!nativeSource.isFetching &&
            !nativeSource.isError &&
            openedSource === selected?.id &&
            nativeSource.data && (
              <section
                className="flex min-w-0 flex-col gap-3"
                aria-label={t(($) => $.inbox.sourceDetail)}
              >
                <p>
                  {t(($) => $.inbox.sourceKinds[nativeSource.data.kind])} ·{" "}
                  {t(($) => $.inbox.workStates[nativeSource.data.workState])}
                </p>
                {nativeSource.data.at && (
                  <p className="tabular-nums">{format.format(new Date(nativeSource.data.at))}</p>
                )}
                {nativeSource.data.note && (
                  <p className="whitespace-pre-wrap break-words">{nativeSource.data.note}</p>
                )}
                <LinkButton
                  variant="outline"
                  href={
                    nativeSource.data.ownHref &&
                    (memberPersonId ?? workspace.data?.selected?.self_context?.person_id) ===
                      nativeSource.data.personId
                      ? nativeSource.data.ownHref
                      : nativeSource.data.href
                  }
                  isDisabled={locked}
                >
                  {t(($) => $.inbox.sourceFlow)}
                </LinkButton>
              </section>
            )}
        </>
      }
      pagination={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            isDisabled={locked || list.isFetching || index === 0}
            onPress={() => {
              setSelected(undefined);
              setChecked([]);
              command.reset();
              setIndex((value) => value - 1);
            }}
          >
            {t(($) => $.people.previous)}
          </Button>
          <Button
            variant="outline"
            size="sm"
            isDisabled={locked || list.isFetching || list.isError || !list.data?.next_cursor}
            onPress={() => {
              const next = list.data?.next_cursor;
              if (!next || cursors.includes(next)) return;
              setSelected(undefined);
              setChecked([]);
              command.reset();
              setCursors([...cursors.slice(0, index + 1), next]);
              setIndex((value) => value + 1);
            }}
          >
            {t(($) => $.people.next)}
          </Button>
        </div>
      }
    />
  );
}
