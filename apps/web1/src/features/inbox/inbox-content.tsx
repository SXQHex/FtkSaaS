import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { NotificationView } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { InboxView, type InboxRow, type InboxFilter } from "./inbox-view";
import {
  readInbox,
  readNotificationState,
  notificationReadIntent,
  markNotificationRead,
  readNotificationReceipt,
  readNotificationResult,
} from "./inbox";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
export function InboxContent({
  scope,
  timezone,
  onLockChange,
}: {
  scope: ClientScope;
  timezone: string;
  onLockChange: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    router = useRouter();
  const [filter, setFilter] = useState<InboxFilter>("all"),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0),
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
  const prefix = ["inbox", scope.accountId, scope.orgId, scope.centerId];
  const list = useQuery({
    queryKey: [...prefix, filter, cursors[index]],
    queryFn: async () => {
      const page = await readInbox(scope, filter === "unread", cursors[index]);
      if (page.next_cursor && cursors.includes(page.next_cursor))
        throw new Error("INBOX_CURSOR_UNAVAILABLE");
      return page;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
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
    for (const cause of [list.error, source.error]) if (cause) accessLost(cause);
  }, [list.error, source.error, accessLost]);
  const command = useMemberCommand({
    write: markNotificationRead,
    readReceipt: readNotificationReceipt,
    readResult: readNotificationResult,
    onAccessLost: accessLost,
    onRefresh: async (value) => {
      queries.setQueryData(stateKey, value);
      await queries.invalidateQueries({ queryKey: [...prefix, filter, cursors[index]] });
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
  async function markRead() {
    if (
      pending.current ||
      locked ||
      !source.data ||
      source.isError ||
      source.data.state !== "unread" ||
      command.state !== "ready"
    )
      return;
    pending.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await notificationReadIntent(scope, source.data);
      if (mounted.current) await command.start(intent);
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
      rows={list.isError ? null : (list.data?.items.map(present) ?? null)}
      selected={selected ? present(selected) : null}
      filter={filter}
      onFilter={(value) => {
        if (locked || value === "todo") return;
        command.reset();
        setSelected(undefined);
        setFilter(value);
        setCursors([undefined]);
        setIndex(0);
        setError(undefined);
      }}
      query=""
      onQuery={() => {}}
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
        void markRead();
      }}
      canMarkRead={!source.isError && source.data?.state === "unread" && command.state === "ready"}
      onMarkAll={() => {}}
      locked={locked}
      notice={
        <>
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
          <EventCommandNotice command={command} onReload={reset} />
          {(source.isError || error) && (
            <Alert variant="destructive">
              <AlertDescription>
                {error ?? t(($) => $.inbox.readError)}{" "}
                <Button variant="outline" size="sm" isDisabled={locked} onPress={reset}>
                  {t(($) => $.auth.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">{t(($) => $.inbox.sourceUnavailable)}</p>
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
