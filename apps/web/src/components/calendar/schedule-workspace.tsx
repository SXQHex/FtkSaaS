"use client";

import dynamic from "next/dynamic";
import { WorkspaceLoading } from "../workspace-loading";
import { useContextPreference } from "../context-preference";
import { useUserPreferences } from "../user-preferences";
import { useEffect, useState } from "react";
import { useTranslations, useTimeZone } from "next-intl";
import type { CenterView, OrganizationView } from "@ftksaas/api-contracts";
import { CalendarDays } from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import {
  matchesCalendarFilters,
  type CalendarFilters,
  calendarEntry,
  calendarInterval,
  dateInZone,
  type CalendarEntry,
  type CalendarRange,
} from "../../lib/schedule";
import { getCalendar, errorMessageKey } from "../../lib/api";
import { SessionCalendar } from "./session-calendar";
import { SessionDetail } from "./session-detail";
import { LessonRequests } from "../bookings/lesson-requests";
const ProgramManager = dynamic(
  () => import("../programs/program-manager").then((module) => module.ProgramManager),
  { loading: WorkspaceLoading },
);

const CalendarResourceFilters = dynamic(
  () => import("./calendar-resource-filters").then((m) => m.CalendarResourceFilters),
  { loading: WorkspaceLoading },
);

export function ScheduleWorkspace({
  studios,
  actorId,
}: {
  actorId?: string;
  studios: { organization: OrganizationView; centers: CenterView[] }[];
}) {
  const t = useTranslations("calendar");
  const context = useContextPreference(actorId);
  const scopes = studios
    .filter(({ organization }) => ["normal", "grace"].includes(organization.access_mode))
    .flatMap(({ organization, centers }) =>
      centers
        .filter((center) => center.accessible && center.state === "active")
        .map((center) => ({ organization, center })),
    );
  const [selected, setSelected] = useState("");
  const scope =
    scopes.find(({ center }) => center.id === selected) ??
    scopes.find(
      (s) =>
        s.organization.id === context.preferred?.org_id &&
        (!context.preferred.center_id || s.center.id === context.preferred.center_id),
    ) ??
    (context.requireChoice ? undefined : scopes[0]);
  function selectCenter(id: string) {
    setSelected(id);
    const next = scopes.find((s) => s.center.id === id);
    if (next)
      context.remember({
        org_id: next.organization.id,
        center_id: next.center.id,
        discipline_id: null,
      });
  }
  if (!scope && scopes.length)
    return (
      <section className="space-y-3">
        <h2>{t("chooseContext")}</h2>
        {scopes.map((s) => (
          <Button key={s.center.id} variant="outline" onClick={() => selectCenter(s.center.id)}>
            {s.organization.name} / {s.center.name}
          </Button>
        ))}
      </section>
    );
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
              onClick={() => selectCenter(center.id)}
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
      {context.failed && <p role="alert">{t("rememberFailed")}</p>}
      <CalendarContent
        key={`${actorId ?? "member"}:${scope.organization.id}:${scope.center.id}`}
        actorId={actorId}
        orgId={scope.organization.id}
        center={scope.center}
        initialDiscipline={
          context.preferred?.org_id === scope.organization.id &&
          context.preferred?.center_id === scope.center.id
            ? (context.preferred.discipline_id ?? undefined)
            : undefined
        }
      />
    </div>
  );
}

function CalendarContent({
  orgId,
  center,
  actorId,
  initialDiscipline,
}: {
  initialDiscipline?: string;
  orgId: string;
  center: CenterView;
  actorId?: string;
}) {
  const preferences = useUserPreferences();
  const displayTimeZone = useTimeZone();
  const viewZone = preferences ? (displayTimeZone ?? center.timezone) : center.timezone;
  const program = useTranslations("program");
  const [managing, setManaging] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false),
    [filters, setFilters] = useState<CalendarFilters>(
      initialDiscipline ? { disciplineId: initialDiscipline } : {},
    );
  const calendar = useTranslations("calendar");
  const api = useTranslations("api");
  const [date, setDate] = useState(() => dateInZone(new Date(), viewZone));
  const [range, setRange] = useState<CalendarRange>(preferences?.calendar_view ?? "day");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const [result, setResult] = useState<{
    key: string;
    entries?: CalendarEntry[];
    error?: string;
  } | null>(null);
  const interval = calendarInterval(date, range, viewZone, preferences?.week_start);
  const key = `${orgId}:${center.id}:${interval.starts_at}:${interval.ends_at}:${attempt}`;
  useEffect(() => {
    const lifetime = new AbortController();
    getCalendar({
      org_id: orgId,
      center_id: center.id,
      interval: { starts_at: interval.starts_at, ends_at: interval.ends_at },
    })
      .then((items) => {
        if (!lifetime.signal.aborted) setResult({ key, entries: items.map(calendarEntry) });
      })
      .catch((cause: unknown) => {
        if (!lifetime.signal.aborted) setResult({ key, error: errorMessageKey(cause) });
      });
    return () => {
      lifetime.abort();
    };
  }, [orgId, center.id, interval.starts_at, interval.ends_at, key]);
  const current = result?.key === key ? result : null;
  return (
    <>
      {actorId && (
        <div className="space-y-5">
          <Button
            variant="outline"
            aria-expanded={managing}
            onClick={() => {
              setSelected(null);
              setManaging(!managing);
            }}
          >
            {program(managing ? "hideManager" : "showManager")}
          </Button>
          {managing && (
            <ProgramManager
              key={`${actorId}:${orgId}:${center.id}`}
              scope={{ actorId, orgId, centerId: center.id }}
              timeZone={center.timezone}
              onChanged={() => {
                setSelected(null);
                setAttempt((value) => value + 1);
              }}
            />
          )}
          {actorId && (
            <LessonRequests
              scope={{ actorId, orgId, centerId: center.id }}
              timeZone={center.timezone}
              onChanged={() => setAttempt((n) => n + 1)}
            />
          )}
        </div>
      )}
      {!managing && actorId && (
        <div className="space-y-3">
          <Button
            variant="outline"
            aria-expanded={filtersOpen}
            onClick={() => {
              setSelected(null);
              setFilters({});
              setFiltersOpen((v) => !v);
            }}
          >
            {calendar(filtersOpen ? "resourceFiltersClose" : "resourceFilters")}
          </Button>
          {filtersOpen && (
            <CalendarResourceFilters
              scope={{ actorId, orgId, centerId: center.id }}
              value={filters}
              onChange={(next) => {
                setSelected(null);
                setFilters(next);
              }}
            />
          )}
        </div>
      )}
      {!managing && (
        <SessionCalendar
          date={date}
          range={range}
          timeZone={viewZone}
          entries={(current?.entries ?? []).filter((entry) =>
            matchesCalendarFilters(entry, filters),
          )}
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
      )}
      {!managing && selected && (
        <SessionDetail
          actorId={actorId}
          onChanged={() => setAttempt((value) => value + 1)}
          entry={selected}
          timeZone={center.timezone}
          scope={{ orgId, centerId: center.id }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
