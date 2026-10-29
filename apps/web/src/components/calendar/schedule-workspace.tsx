"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CenterView, OrganizationView } from "@ftksaas/api-contracts";
import { CalendarDays } from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import {
  calendarEntry,
  calendarInterval,
  dateInZone,
  type CalendarEntry,
  type CalendarRange,
} from "../../lib/schedule";
import { getCalendar, errorMessageKey } from "../../lib/api";
import { SessionCalendar } from "./session-calendar";
import { SessionDetail } from "./session-detail";

export function ScheduleWorkspace({
  studios,
}: {
  studios: { organization: OrganizationView; centers: CenterView[] }[];
}) {
  const t = useTranslations("calendar");
  const scopes = studios
    .filter(({ organization }) => ["normal", "grace"].includes(organization.access_mode))
    .flatMap(({ organization, centers }) =>
      centers
        .filter((center) => center.accessible && center.state === "active")
        .map((center) => ({ organization, center })),
    );
  const [selected, setSelected] = useState("");
  const scope = scopes.find(({ center }) => center.id === selected) ?? scopes[0];
  if (!scope)
    return (
      <section className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
        <CalendarDays className="mx-auto mb-4 size-8 text-muted-foreground" aria-hidden="true" />
        <h2 className="font-semibold">{t("noCenter")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {t("noCenterHint")}
        </p>
      </section>
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {scopes.length > 1 ? (
          scopes.map(({ organization, center }) => (
            <Button
              key={center.id}
              variant={scope.center.id === center.id ? "secondary" : "outline"}
              aria-pressed={scope.center.id === center.id}
              onClick={() => setSelected(center.id)}
            >
              {organization.name} / {center.name}
            </Button>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {scope.organization.name} / {scope.center.name}
          </p>
        )}
      </div>
      <CalendarContent
        key={`${scope.organization.id}:${scope.center.id}`}
        orgId={scope.organization.id}
        center={scope.center}
      />
    </div>
  );
}

function CalendarContent({ orgId, center }: { orgId: string; center: CenterView }) {
  const api = useTranslations("api");
  const [date, setDate] = useState(() => dateInZone(new Date(), center.timezone));
  const [range, setRange] = useState<CalendarRange>("day");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const [result, setResult] = useState<{
    key: string;
    entries?: CalendarEntry[];
    error?: string;
  } | null>(null);
  const interval = calendarInterval(date, range, center.timezone);
  const key = `${orgId}:${center.id}:${interval.starts_at}:${interval.ends_at}:${attempt}`;
  useEffect(() => {
    let active = true;
    getCalendar({
      org_id: orgId,
      center_id: center.id,
      interval: { starts_at: interval.starts_at, ends_at: interval.ends_at },
    })
      .then((items) => {
        if (active) setResult({ key, entries: items.map(calendarEntry) });
      })
      .catch((cause: unknown) => {
        if (active) setResult({ key, error: errorMessageKey(cause) });
      });
    return () => {
      active = false;
    };
  }, [orgId, center.id, interval.starts_at, interval.ends_at, key]);
  const current = result?.key === key ? result : null;
  return (
    <>
      <SessionCalendar
        date={date}
        range={range}
        timeZone={center.timezone}
        entries={current?.entries ?? []}
        loading={!current}
        error={current?.error ? api(current.error) : undefined}
        onDateChange={(value) => {
          setSelected(null);
          setDate(value);
        }}
        onRangeChange={(value) => {
          setSelected(null);
          setRange(value);
        }}
        onSelect={setSelected}
        onRefresh={() => {
          setSelected(null);
          setAttempt((value) => value + 1);
        }}
      />
      {selected && (
        <SessionDetail
          entry={selected}
          timeZone={center.timezone}
          scope={{ orgId, centerId: center.id }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
