import { lazy, Suspense, useCallback, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import trLocale from "@fullcalendar/react/locales/tr";
import type { DatesSetInfo } from "@fullcalendar/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@ftksaas/ui/components/card";
import { Skeleton } from "@ftksaas/ui/components/skeleton";
import { Badge } from "@ftksaas/ui/components/badge";
const Calendar = lazy(() =>
  import("../../components/event-calendar").then((module) => ({ default: module.EventCalendar })),
);
const views = ["timeGridWeek", "listWeek"];
const widths = { timeGridWeek: "52rem" };
const viewOptions = {
  listWeek: {
    eventContent: (info: import("@fullcalendar/react").EventDisplayInfo) => (
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="tabular-nums text-muted-foreground">{info.timeText}</span>
        <span className="min-w-0 wrap-anywhere">{info.event.title}</span>
        {typeof info.event.extendedProps.status === "string" && (
          <Badge variant="outline" className="whitespace-normal">
            {info.event.extendedProps.status}
          </Badge>
        )}
      </span>
    ),
  },
};
export interface InstructorScheduleEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  status: string;
}
export function InstructorScheduleView({
  timezone,
  initialDate,
  weekStart,
  now,
  events,
  range,
  summary,
  state,
  notice,
  onRange,
  onOpen,
}: {
  timezone: string;
  initialDate: string;
  weekStart: "monday" | "sunday";
  now: string;
  events: InstructorScheduleEvent[];
  range: string;
  summary: string;
  state: "pending" | "error" | "ready";
  notice?: ReactNode;
  onRange: (interval: { starts_at: string; ends_at: string }) => void;
  onOpen?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const locale = useMemo(
    () => ({
      ...trLocale,
      todayText: t(($) => $.instructorSchedule.thisWeek),
      prevText: t(($) => $.instructorSchedule.previous),
      nextText: t(($) => $.instructorSchedule.next),
      listText: t(($) => $.instructorSchedule.agenda),
      noEventsText:
        state === "error"
          ? t(($) => $.instructorToday.unread)
          : state === "pending"
            ? t(($) => $.instructorSchedule.loading)
            : t(($) => $.instructorSchedule.empty),
    }),
    [t, state],
  );
  const datesSet = useCallback(
    (info: DatesSetInfo) =>
      onRange({ starts_at: info.start.toISOString(), ends_at: info.end.toISOString() }),
    [onRange],
  );
  return (
    <div className="@container flex min-w-0 flex-col gap-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(($) => $.instructorSchedule.title)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(($) => $.instructorSchedule.description)}
        </p>
      </header>
      <p className="text-sm text-muted-foreground">
        {t(($) => $.instructorToday.timezone, { timezone })}
      </p>
      {notice}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <h2>{range}</h2>
          </CardTitle>
          <CardDescription>{summary}</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <Calendar
              initialView="timeGridWeek"
              availableViews={views}
              views={viewOptions}
              viewMinWidths={widths}
              viewScrollHeight="min(65dvh,40rem)"
              scrollRegionLabel={t(($) => $.instructorSchedule.region)}
              timeZone={timezone}
              initialDate={initialDate}
              firstDay={weekStart === "sunday" ? 0 : 1}
              now={now}
              locale={locale}
              height="auto"
              editable={false}
              selectable={false}
              droppable={false}
              eventStartEditable={false}
              eventDurationEditable={false}
              allDaySlot={false}
              nowIndicator
              events={
                state === "ready"
                  ? events.map(({ status, ...row }) => ({
                      ...row,
                      extendedProps: { status },
                      interactive: Boolean(onOpen),
                      editable: false,
                    }))
                  : []
              }
              datesSet={datesSet}
              eventClick={(info) => {
                if (state === "ready") onOpen?.(info.event.id);
              }}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
