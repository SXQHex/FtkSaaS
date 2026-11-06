"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { SessionView } from "@ftksaas/api-contracts";
import { ArrowLeft, ArrowUpRight, CalendarPlus, Pencil, X, XCircle } from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@ftksaas/ui/components/sheet";
import { errorMessageKey, getSession } from "../../lib/api";
import type { CalendarEntry } from "../../lib/schedule";
import { SessionCancellation } from "./session-cancellation";
import { ReplacementSession } from "./replacement-session";
import { ProgramRecovery } from "../programs/program-recovery";
import { SessionChange } from "./session-change";
import { sessionPath } from "../../lib/session-route";
import { AttendanceAccess } from "../attendance/attendance-access";
import { SessionBookings } from "../bookings/session-bookings";
import { SessionSummary, SessionFacts } from "./session-summary";

export function SessionDetail({
  entry,
  timeZone,
  onClose,
  scope,
  actorId,
  onChanged,
}: {
  actorId?: string;
  onChanged?: () => void;
  entry: CalendarEntry;
  timeZone: string;
  onClose: () => void;
  scope?: { orgId: string; centerId: string };
}) {
  const t = useTranslations("calendar");
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        showCloseButton={false}
        className="w-full gap-0 overflow-y-auto sm:scroll-pt-28 sm:max-w-xl"
        onOpenAutoFocus={() => {
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
      >
        <SheetHeader className="top-0 z-10 flex-row items-start justify-between gap-3 border-b bg-background p-5 sm:sticky">
          <div className="min-w-0 space-y-1">
            <SheetTitle className="break-words">{entry.title}</SheetTitle>
            <SheetDescription className="break-words">
              {t(entry.kind)} · {timeZone}
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="shrink-0" aria-label={t("close")}>
              <X aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <div className="min-w-0 space-y-6 px-5 py-6 wrap-anywhere">
          {scope && entry.kind === "session" ? (
            <LiveSessionDetail
              key={`${actorId ?? "read"}:${scope.orgId}:${scope.centerId}:${entry.id}`}
              entry={entry}
              actorId={actorId}
              onChanged={onChanged}
              scope={scope}
              timeZone={timeZone}
            />
          ) : (
            <SessionFacts entry={entry} timeZone={timeZone} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LiveSessionDetail({
  entry,
  scope,
  timeZone,
  actorId,
  onChanged,
}: {
  actorId?: string;
  onChanged?: () => void;
  entry: CalendarEntry;
  scope: { orgId: string; centerId: string };
  timeZone: string;
}) {
  const t = useTranslations("calendar");
  const api = useTranslations("api");
  const lifecycle = useTranslations("sessionLifecycle");
  const format = useFormatter();
  const [attempt, setAttempt] = useState(0);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [editing, setEditing] = useState<"change" | "cancel" | "replace" | null>(null);
  const editContext = useRef<HTMLElement | null>(null);
  const actionsTitle = useRef<HTMLHeadingElement | null>(null);
  const actionButtons = useRef<
    Partial<Record<"change" | "cancel" | "replace", HTMLButtonElement | null>>
  >({});
  const returnTo = useRef<typeof editing>(null);
  const [result, setResult] = useState<{
    attempt: number;
    session?: SessionView;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    getSession(scope.orgId, scope.centerId, entry.id)
      .then((session) => {
        if (active) setResult({ attempt, session });
      })
      .catch((cause: unknown) => {
        if (active) setResult({ attempt, error: errorMessageKey(cause) });
      });
    return () => {
      active = false;
    };
  }, [scope.orgId, scope.centerId, entry.id, attempt]);
  useEffect(() => {
    if (editing) editContext.current?.focus();
    else if (returnTo.current && result?.attempt === attempt && result.session) {
      (actionButtons.current[returnTo.current] ?? actionsTitle.current)?.focus();
      returnTo.current = null;
    }
  }, [editing, attempt, result]);
  function refresh() {
    returnTo.current = editing;
    setEditing(null);
    setAttempt((n) => n + 1);
  }
  function saved(createdId?: string) {
    if (editing === "replace" && createdId) setReplacementId(createdId);
    refresh();
    onChanged?.();
  }
  const bookingChanged = useCallback(
    (session: SessionView) =>
      setResult((current) => (current?.attempt === attempt ? { attempt, session } : current)),
    [attempt],
  );
  const commandScope = actorId ? { ...scope, actorId } : null;
  if (!result || result.attempt !== attempt)
    return (
      <output className="block py-8 text-sm text-muted-foreground" aria-live="polite">
        {t("detailLoading")}
      </output>
    );
  if (result.error || !result.session)
    return (
      <div className="space-y-4 rounded-lg border p-5">
        <p role="alert">{api(result.error ?? "unknown")}</p>
        {commandScope && (
          <ProgramRecovery
            key={`${attempt}:${actorId}`}
            scope={commandScope}
            onReplacementCreated={setReplacementId}
            onSaved={() => saved()}
          />
        )}
        <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
          {t("retry")}
        </Button>
      </div>
    );
  if (editing && commandScope)
    return (
      <div className="space-y-5">
        <section
          ref={editContext}
          tabIndex={-1}
          aria-label={t("editingSession")}
          className="space-y-2 rounded-xl border bg-muted/30 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <p className="text-xs text-muted-foreground">{t("editingSession")}</p>
          <p className="text-sm font-medium">
            {format.dateTime(new Date(result.session.starts_at), { timeZone, dateStyle: "long" })}
          </p>
          <p className="text-sm tabular-nums">
            {format.dateTime(new Date(result.session.starts_at), {
              timeZone,
              timeStyle: "short",
              hourCycle: "h23",
            })}
            {" – "}
            {format.dateTime(new Date(result.session.ends_at), {
              timeZone,
              timeStyle: "short",
              hourCycle: "h23",
            })}
          </p>
          {format.dateTime(new Date(result.session.starts_at), { timeZone, dateStyle: "long" }) !==
            format.dateTime(new Date(result.session.ends_at), { timeZone, dateStyle: "long" }) && (
            <p className="text-xs text-muted-foreground">
              {t("ends", {
                date: format.dateTime(new Date(result.session.ends_at), {
                  timeZone,
                  dateStyle: "long",
                }),
              })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{timeZone}</p>
          <Badge variant="outline">{t(`state.${result.session.state}`)}</Badge>
        </section>
        {editing !== "change" && (
          <h2 className="text-xl font-semibold">
            {lifecycle(editing === "cancel" ? "cancelTitle" : "replacementTitle")}
          </h2>
        )}
        {editing === "change" ? (
          <SessionChange
            key={`${scope.orgId}:${scope.centerId}:${entry.id}:${attempt}:${actorId}`}
            session={result.session}
            orgId={scope.orgId}
            centerId={scope.centerId}
            actorId={commandScope.actorId}
            timeZone={timeZone}
            onClose={refresh}
            onSaved={() => saved()}
          />
        ) : editing === "cancel" ? (
          <SessionCancellation
            scope={commandScope}
            sessionId={result.session.id}
            timeZone={timeZone}
            onSaved={saved}
          />
        ) : (
          <ReplacementSession
            scope={commandScope}
            source={result.session}
            timeZone={timeZone}
            onSaved={saved}
          />
        )}
        {editing !== "change" && (
          <Button variant="ghost" className="h-auto min-h-11 whitespace-normal" onClick={refresh}>
            <ArrowLeft aria-hidden="true" />
            {t("backToDetail")}
          </Button>
        )}
      </div>
    );
  return (
    <>
      <SessionSummary session={result.session} timeZone={timeZone} />
      {commandScope && (
        <SessionBookings scope={commandScope} session={result.session} onChanged={bookingChanged} />
      )}
      {commandScope && (
        <AttendanceAccess
          scope={commandScope}
          sessionId={result.session.id}
          timeZone={timeZone}
          onChanged={bookingChanged}
        />
      )}
      {replacementId && (
        <Button asChild variant="outline">
          <Link href={sessionPath(scope.orgId, replacementId, scope.centerId)}>
            {lifecycle("viewReplacement")}
          </Link>
        </Button>
      )}
      {commandScope && (
        <ProgramRecovery
          key={`${attempt}:${actorId}`}
          scope={commandScope}
          onReplacementCreated={setReplacementId}
          onSaved={() => saved()}
        />
      )}
      {commandScope && (
        <section className="space-y-3 border-t pt-5" aria-label={t("sessionActions")}>
          <h3 ref={actionsTitle} tabIndex={-1} className="font-medium">
            {t("sessionActions")}
          </h3>
          <div className="grid min-w-0 gap-3">
            <Button
              ref={(node) => {
                actionButtons.current.change = node;
              }}
              variant="outline"
              className="h-auto min-h-11 justify-start whitespace-normal text-left"
              onClick={() => setEditing("change")}
            >
              <Pencil aria-hidden="true" />
              {t("changeSession")}
            </Button>
            {result.session.state === "cancelled" && (
              <Button
                ref={(node) => {
                  actionButtons.current.replace = node;
                }}
                variant="outline"
                className="h-auto min-h-11 justify-start whitespace-normal text-left"
                onClick={() => setEditing("replace")}
              >
                <CalendarPlus aria-hidden="true" />
                {lifecycle("replacementTitle")}
              </Button>
            )}
            {result.session.state === "planned" && result.session.attendance_state === "open" && (
              <div className="border-t pt-3">
                <Button
                  ref={(node) => {
                    actionButtons.current.cancel = node;
                  }}
                  variant="ghost"
                  className="h-auto min-h-11 max-w-full justify-start whitespace-normal text-left text-destructive hover:text-destructive"
                  onClick={() => setEditing("cancel")}
                >
                  <XCircle aria-hidden="true" />
                  {lifecycle("cancelTitle")}
                </Button>
              </div>
            )}
          </div>
        </section>
      )}
      <Button
        asChild
        variant="outline"
        className="h-auto min-h-11 w-full justify-between whitespace-normal text-left"
      >
        <Link href={sessionPath(scope.orgId, entry.id, scope.centerId)}>
          {t("openPage")}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Button>
    </>
  );
}
