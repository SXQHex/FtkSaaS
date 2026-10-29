"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { SessionView } from "@ftksaas/api-contracts";
import { CalendarDays, Clock3, Users, X } from "lucide-react";
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

export function SessionDetail({
  entry,
  timeZone,
  onClose,
  scope,
}: {
  entry: CalendarEntry;
  timeZone: string;
  onClose: () => void;
  scope?: { orgId: string; centerId: string };
}) {
  const t = useTranslations("calendar");
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent showCloseButton={false} className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-14">
          <SheetTitle>{entry.title}</SheetTitle>
          <SheetDescription>
            {t(entry.kind)} · {timeZone}
          </SheetDescription>
        </SheetHeader>
        <SheetClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            aria-label={t("close")}
          >
            <X />
          </Button>
        </SheetClose>
        <div className="space-y-6 px-5 pb-8">
          {scope && entry.kind === "session" ? (
            <LiveSessionDetail
              key={`${scope.orgId}:${entry.id}`}
              entry={entry}
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
}: {
  entry: CalendarEntry;
  scope: { orgId: string; centerId: string };
  timeZone: string;
}) {
  const t = useTranslations("calendar");
  const api = useTranslations("api");
  const [attempt, setAttempt] = useState(0);
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
  if (!result || result.attempt !== attempt)
    return (
      <output className="block py-8 text-sm text-muted-foreground" aria-live="polite">
        {t("detailLoading")}
      </output>
    );
  if (result.error || !result.session)
    return (
      <div role="alert" className="space-y-4 rounded-lg border p-5">
        <p>{api(result.error ?? "unknown")}</p>
        <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
          {t("retry")}
        </Button>
      </div>
    );
  const session = result.session;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{t(`state.${session.state}`)}</Badge>
        <Badge variant="outline">{t(`format.${session.format}`)}</Badge>
      </div>
      <SessionFacts
        entry={{
          ...entry,
          startsAt: session.starts_at,
          endsAt: session.ends_at,
          capacity: session.capacity,
        }}
        timeZone={timeZone}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <span className="text-sm text-muted-foreground">{t("attendance")}</span>
        <Badge variant="outline">{t(`attendanceState.${session.attendance_state}`)}</Badge>
      </div>
    </>
  );
}

function SessionFacts({ entry, timeZone }: { entry: CalendarEntry; timeZone: string }) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const date = (instant: string) =>
    new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "full" }).format(new Date(instant));
  const time = (instant: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(instant));
  return (
    <>
      <dl className="space-y-5 rounded-xl border bg-muted/30 p-5">
        <div>
          <dt className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden="true" />
            {t("date")}
          </dt>
          <dd className="text-sm font-medium">{date(entry.startsAt)}</dd>
        </div>
        <div>
          <dt className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="size-4" aria-hidden="true" />
            {t("time")}
          </dt>
          <dd className="text-sm font-medium tabular-nums">
            {time(entry.startsAt)} – {time(entry.endsAt)}
            {date(entry.startsAt) !== date(entry.endsAt) && (
              <span className="mt-1 block text-xs text-muted-foreground">
                {t("ends", { date: date(entry.endsAt) })}
              </span>
            )}
          </dd>
        </div>
      </dl>
      {entry.capacity && (
        <section>
          <h3 className="mb-4 flex items-center gap-2 font-medium">
            <Users className="size-4" aria-hidden="true" />
            {t("capacity")}
          </h3>
          <dl className="grid grid-cols-3 gap-2 rounded-xl border p-4">
            {(["total", "held", "remaining"] as const).map((key) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">{t(`capacityLabels.${key}`)}</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">{entry.capacity![key]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("capacityHint")}</p>
        </section>
      )}
    </>
  );
}
