"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { EntityRef, NotificationView } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@ftksaas/ui/components/sheet";
import { getNotificationVersion, inboxTarget, listInbox, listAudit } from "../../lib/inbox";
import type { SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { NotificationDelivery } from "./notification-delivery";
import { AuditHistory } from "./audit-history";

type FeedReads = {
  list?: typeof listInbox;
  version?: typeof getNotificationVersion;
  historyList?: typeof listAudit;
};
export function InboxFeed({ scope, ...reads }: { scope: SetupScope } & FeedReads) {
  return <ConnectedInbox key={JSON.stringify(scope)} scope={scope} {...reads} />;
}
function ConnectedInbox({ scope, ...reads }: { scope: SetupScope } & FeedReads) {
  const [revision, setRevision] = useState(0),
    [unread, setUnread] = useState(true);
  const command = useSetupCommand(scope, "inbox-read", () => setRevision((n) => n + 1));
  return (
    <InboxFeedView
      key={revision}
      scope={scope}
      command={command}
      unread={unread}
      onUnreadChange={setUnread}
      {...reads}
    />
  );
}
export function InboxFeedView({
  scope,
  command,
  unread,
  onUnreadChange,
  list = listInbox,
  version = getNotificationVersion,
  historyList = listAudit,
}: {
  scope: SetupScope;
  command: ReturnType<typeof useSetupCommand>;
  unread: boolean;
  onUnreadChange: (value: boolean) => void;
} & FeedReads) {
  const t = useTranslations("inbox");
  const format = useFormatter();
  const [cursor, setCursor] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState<Awaited<ReturnType<typeof listInbox>> | null>(null);
  const [error, setError] = useState(false);
  const [readError, setReadError] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [confirm, setConfirm] = useState<{ notice: NotificationView; version: number } | null>(
    null,
  );
  const [history, setHistory] = useState<EntityRef | null>(null);
  const alive = useRef(true);
  const prepareLock = useRef(false);
  const generation = useRef(0);
  const historyTrigger = useRef<HTMLButtonElement | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const readTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (confirm) confirmButton.current?.focus();
  }, [confirm]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function reload() {
    generation.current += 1;
    setConfirm(null);
    setReadError(false);
    setPage(null);
    setError(false);
    setCursor(undefined);
    setRetry((n) => n + 1);
  }
  useEffect(() => {
    if (command.message === "saved" || command.message === "failed") heading.current?.focus();
  }, [command.message]);
  useEffect(() => {
    let active = true;
    void list(scope, unread, cursor)
      .then((result) => {
        if (active) setPage(result);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [scope, unread, cursor, retry, list]);
  async function prepare(notice: NotificationView) {
    if (prepareLock.current || command.pending || command.busy) return;
    const currentGeneration = generation.current;
    prepareLock.current = true;
    setPreparing(true);
    setReadError(false);
    setConfirm(null);
    try {
      const currentVersion = await version(scope, notice.id);
      if (!alive.current || generation.current !== currentGeneration) return;
      if (currentVersion === null) setReadError(true);
      else setConfirm({ notice, version: currentVersion });
    } catch {
      if (alive.current && generation.current === currentGeneration) setReadError(true);
    } finally {
      prepareLock.current = false;
      if (alive.current) setPreparing(false);
    }
  }
  return (
    <section className="space-y-5" aria-label={t("title")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={heading} tabIndex={-1} className="font-semibold">
          {t("title")}
        </h2>
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal"
          variant="outline"
          disabled={preparing}
          onClick={reload}
        >
          {t("reload")}
        </Button>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={unread}
          onChange={(event) => {
            reload();
            onUnreadChange(event.target.checked);
          }}
        />
        {t("unreadOnly")}
      </label>
      <SetupFeedback command={command} />
      {readError && <p role="alert">{t("versionError")}</p>}
      {confirm && !command.pending && (
        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
          <p className="break-words">
            {t("confirmRead")}:{" "}
            {confirm.notice.payload.title ||
              (t.has(`kinds.${confirm.notice.kind}`)
                ? t(`kinds.${confirm.notice.kind}`)
                : t("notice"))}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              ref={confirmButton}
              disabled={command.busy}
              onClick={() => {
                setConfirm(null);
                heading.current?.focus();
                void command.run({
                  operation: "notification_mark_read_v1",
                  input: {
                    org_id: scope.orgId,
                    ...(scope.centerId ? { center_id: scope.centerId } : {}),
                    notification_id: confirm.notice.id,
                    expected_version: confirm.version,
                    operation_key: v7(),
                  },
                });
              }}
            >
              {t("confirm")}
            </Button>
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              variant="outline"
              onClick={() => {
                setConfirm(null);
                (readTrigger.current?.isConnected ? readTrigger.current : heading.current)?.focus();
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
      {error ? (
        <p role="alert">{t("loadError")}</p>
      ) : !page ? (
        <output>{t("loading")}</output>
      ) : (
        <>
          {page.items.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card px-4 sm:px-6">
              {page.items.map((notice) => {
                const target = inboxTarget(scope.orgId, notice.payload.subject);
                return (
                  <li key={notice.id} className="space-y-3 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="min-w-0 break-words font-medium">
                        {notice.payload.title ||
                          (t.has(`kinds.${notice.kind}`) ? t(`kinds.${notice.kind}`) : t("notice"))}
                      </h3>
                      <Badge
                        variant="outline"
                        className="max-w-full whitespace-normal wrap-anywhere"
                      >
                        {t(notice.read_at ? "read" : "unread")}
                      </Badge>
                    </div>
                    {notice.email_job && <NotificationDelivery job={notice.email_job} />}
                    {notice.payload.body && (
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {notice.payload.body}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(notice.created_at), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {target ? (
                        <Link
                          href={target}
                          className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                        >
                          {t("openTarget")}
                        </Link>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t("targetUnsupported")}</p>
                      )}
                      {!notice.read_at && (
                        <Button
                          className="h-auto min-h-11 max-w-full whitespace-normal"
                          variant="outline"
                          disabled={preparing || command.busy || !!command.pending}
                          onClick={(event) => {
                            readTrigger.current = event.currentTarget;
                            void prepare(notice);
                          }}
                        >
                          {t("markRead")}
                        </Button>
                      )}
                      <Button
                        className="h-auto min-h-11 max-w-full whitespace-normal"
                        variant="ghost"
                        onClick={(event) => {
                          historyTrigger.current = event.currentTarget;
                          setHistory(notice.payload.subject);
                        }}
                      >
                        {t("history")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {page.next_cursor && (
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              variant="outline"
              onClick={() => {
                generation.current += 1;
                setConfirm(null);
                setReadError(false);
                setPage(null);
                setError(false);
                setCursor(page.next_cursor ?? undefined);
              }}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
      <Sheet
        open={!!history}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
        }}
      >
        <SheetContent
          className="w-full overflow-y-auto sm:max-w-xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (historyTrigger.current?.isConnected
              ? historyTrigger.current
              : heading.current
            )?.focus();
          }}
        >
          <SheetHeader>
            <SheetTitle>{t("history")}</SheetTitle>
            <SheetDescription>{t("historyHint")}</SheetDescription>
          </SheetHeader>
          <div className="min-w-0 p-4">
            {history && (
              <AuditHistory
                key={`${history.type}:${history.id}`}
                scope={scope}
                subject={history}
                list={historyList}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
