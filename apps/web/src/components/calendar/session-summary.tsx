"use client";

import { useLocale, useTranslations } from "next-intl";
import type { SessionView } from "@ftksaas/api-contracts";
import { CalendarDays, Clock3 } from "lucide-react";
import { Badge } from "@ftksaas/ui/components/badge";
import type { CalendarEntry } from "../../lib/schedule";
import { SessionCapacity } from "./session-capacity";

export function SessionSummary({ session, timeZone }: { session: SessionView; timeZone: string }) {
  const t = useTranslations("calendar");
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{t(`state.${session.state}`)}</Badge>
        <Badge variant="outline">{t(`format.${session.format}`)}</Badge>
      </div>
      <SessionFacts
        entry={{
          id: session.id,
          kind: "session",
          title: t("detailTitle"),
          startsAt: session.starts_at,
          endsAt: session.ends_at,
        }}
        timeZone={timeZone}
      />
      <SessionCapacity capacity={session.capacity} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <span className="text-sm text-muted-foreground">{t("attendance")}</span>
        <Badge variant="outline">{t(`attendanceState.${session.attendance_state}`)}</Badge>
      </div>
    </>
  );
}

export function SessionFacts({ entry, timeZone }: { entry: CalendarEntry; timeZone: string }) {
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
      {entry.capacity && <SessionCapacity capacity={entry.capacity} />}
    </>
  );
}
