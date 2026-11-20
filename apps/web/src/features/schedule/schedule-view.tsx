import { lazy, Suspense, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PlusIcon } from "lucide-react";
import { cn } from "@ftksaas/ui/lib/utils";
import trLocale from "@fullcalendar/react/locales/tr";
import type {
  EventInput,
  EventDisplayInfo,
  DayHeaderInfo,
  EventDropInfo,
  EventResizeDoneInfo,
  DatesSetInfo,
} from "@fullcalendar/react";
import { Button } from "@ftksaas/ui/components/button";
import { Card, CardContent, CardFooter } from "@ftksaas/ui/components/card";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";
import { Skeleton } from "@ftksaas/ui/components/skeleton";
import { Badge } from "@ftksaas/ui/components/badge";
import { Progress } from "@ftksaas/ui/components/progress";

const Calendar = lazy(() =>
  import("../../components/event-calendar").then((module) => ({ default: module.EventCalendar })),
);
const availableViews = ["timeGridWeek", "timeGridDay"];
const viewMinWidths = { timeGridWeek: "52rem" };
export interface ScheduleChoice {
  id: string;
  label: string;
}
export interface ScheduleEvent {
  id: string;
  kind: "session" | "event";
  title: string;
  start: string;
  end: string;
  room: string | null;
  instructor: string | null;
  state: "planned" | "occurred" | "cancelled" | null;
  canChange: boolean;
  reserved: number | null;
  capacity: number | null;
  draft?: boolean;
}
export interface ScheduleDraftChange {
  id: string;
  start: string;
  end: string;
}
export function ScheduleView({
  events,
  timezone,
  initialDate,
  firstDay,
  now,
  rooms,
  instructors,
  room,
  instructor,
  state,
  locked = false,
  pending = 0,
  notices = [],
  availability,
  onRoom,
  onInstructor,
  onAdd,
  onEvent,
  onRange,
  onDraftChange,
  onUndo,
  onSave,
  onRetry,
}: {
  events: ScheduleEvent[];
  timezone: string;
  initialDate: string;
  firstDay: 0 | 1;
  now?: string;
  rooms: ScheduleChoice[];
  instructors: ScheduleChoice[];
  room: string;
  instructor: string;
  state: "loading" | "ready" | "error";
  locked?: boolean;
  pending?: number;
  notices?: string[];
  availability?: {
    summary: string;
    ranges: { id: string; start: string; end: string; label: string }[];
  };
  onRoom?: (id: string) => void;
  onInstructor?: (id: string) => void;
  onAdd?: () => void;
  onEvent?: (id: string) => void;
  onRange?: (range: { start: string; end: string; timezone: string }) => void;
  onDraftChange?: (change: ScheduleDraftChange) => void;
  onUndo?: () => void;
  onSave?: () => void;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const lookup = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const calendarEvents = useMemo<EventInput[]>(
    () =>
      state !== "ready"
        ? []
        : [
            ...events.map((event) => ({
              id: event.id,
              title: event.title,
              start: event.start,
              end: event.end,
              editable: event.state === "planned" && event.canChange,
              className: cn(
                event.kind === "event" ? "border-l-chart-2" : "border-l-primary",
                event.draft && "border-dashed",
                event.state === "cancelled" && "line-through",
              ),
              color: "var(--card)",
              contrastColor: "var(--foreground)",
            })),
            ...(availability?.ranges.map((range) => ({
              id: range.id,
              title: range.label,
              start: range.start,
              end: range.end,
              display: "background",
              interactive: false,
              editable: false,
            })) ?? []),
          ],
    [events, state, availability],
  );
  const locale = useMemo(
    () => ({
      ...trLocale,
      todayText: t(($) => $.schedule.today),
      weekTextLong: t(($) => $.schedule.week),
      dayText: t(($) => $.schedule.day),
      prevText: t(($) => $.schedule.previous),
      nextText: t(($) => $.schedule.next),
      noEventsText: t(($) => $.schedule.empty),
    }),
    [t],
  );
  const datesSet = useCallback(
    (info: DatesSetInfo) =>
      onRange?.({
        start: info.start.toISOString(),
        end: info.end.toISOString(),
        timezone: info.timeZone,
      }),
    [onRange],
  );
  const select = useCallback(
    (info: { event: { id: string } }) => {
      if (!locked && lookup.has(info.event.id)) onEvent?.(info.event.id);
    },
    [locked, onEvent, lookup],
  );
  const change = useCallback(
    (info: EventDropInfo | EventResizeDoneInfo) => {
      if (locked || !onDraftChange || !info.event.start || !info.event.end) {
        info.revert();
        return;
      }
      onDraftChange({
        id: info.event.id,
        start: info.event.start.toISOString(),
        end: info.event.end.toISOString(),
      });
    },
    [locked, onDraftChange],
  );
  const dayHeader = useCallback(
    (info: DayHeaderInfo) => (
      <span className="flex flex-col items-center gap-1 py-1 text-xs text-muted-foreground">
        <span>
          {new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: timezone }).format(
            info.date,
          )}
        </span>
        <Badge
          variant={info.isToday ? "default" : "secondary"}
          className={cn(
            "size-6 justify-center rounded-full px-0 text-sm",
            !info.isToday && "bg-transparent text-foreground",
          )}
        >
          {new Intl.DateTimeFormat("tr-TR", { day: "numeric", timeZone: timezone }).format(
            info.date,
          )}
        </Badge>
      </span>
    ),
    [timezone],
  );
  const content = useCallback(
    (info: EventDisplayInfo) => {
      const event = lookup.get(info.event.id);
      const eventState = event?.state;
      return (
        <span className="relative flex min-w-0 flex-col overflow-hidden px-1.5 py-0.5 text-left">
          <span className="shrink-0 text-[0.625rem]/2.5 tabular-nums text-muted-foreground">
            {info.timeText}
            {event?.kind === "event" && ` · ${t(($) => $.schedule.eventLabel)}`}
          </span>
          <span className="shrink-0 truncate text-[0.75rem]/3.5 font-medium">
            {info.event.title}
          </span>
          {event && (
            <>
              <span className="flex min-w-0 shrink-0 items-center gap-1 text-[0.625rem]/2.5 tabular-nums text-muted-foreground">
                <span className="min-w-0 truncate">{event.room}</span>
                {event.reserved !== null && event.capacity !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    {event.capacity > 0 && (
                      <Progress
                        className="w-7 shrink-0"
                        aria-label={t(($) => $.schedule.capacity)}
                        value={event.reserved}
                        maxValue={event.capacity}
                      />
                    )}
                    <span className="shrink-0">
                      {t(($) => $.schedule.occupancy, {
                        reserved: event.reserved,
                        capacity: event.capacity,
                      })}
                    </span>
                  </>
                )}
              </span>
              <span className="sr-only">
                {event.instructor}{" "}
                {eventState ? t(($) => $.schedule.sessionStates[eventState]) : null}
                {event.draft ? `, ${t(($) => $.schedule.draft)}` : ""}
              </span>
            </>
          )}
        </span>
      );
    },
    [lookup, t],
  );
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.schedule.title)}</h1>
          <p className="text-sm text-muted-foreground">{t(($) => $.schedule.description)}</p>
        </div>
        <Button onPress={onAdd} isDisabled={locked || !onAdd}>
          <PlusIcon data-icon="inline-start" />
          {t(($) => $.schedule.add)}
        </Button>
      </header>
      <Card className="min-w-0 gap-0 pt-3">
        <CardContent className="px-0">
          {state === "error" && (
            <Empty>
              <EmptyDescription role="status">{t(($) => $.schedule.readError)}</EmptyDescription>
              <Button variant="outline" onPress={onRetry} isDisabled={locked || !onRetry}>
                {t(($) => $.people.refresh)}
              </Button>
            </Empty>
          )}
          <Suspense
            fallback={
              <Skeleton className="mx-5 h-[34rem]" aria-label={t(($) => $.schedule.loading)} />
            }
          >
            <Calendar
              key={timezone}
              className="min-w-0 gap-3"
              initialDate={initialDate}
              now={now}
              timeZone={timezone}
              locale={locale}
              availableViews={availableViews}
              borderless
              contentHeight="auto"
              viewScrollHeight="max(22rem, calc(100dvh - 17rem))"
              tableHeaderSticky
              viewMinWidths={viewMinWidths}
              scrollRegionLabel={t(($) => $.schedule.daysScroll)}
              initialScrollTargetClass="web1-calendar-initial-hour"
              slotLaneClass={(info) =>
                cn(
                  "border",
                  info.isMinor && "border-dotted",
                  info.time?.milliseconds === 9 * 60 * 60 * 1000 && "web1-calendar-initial-hour",
                )
              }
              eventMinHeight={26}
              firstDay={firstDay}
              titleFormat={{ year: "numeric", month: "long", day: "numeric" }}
              dayHeaderContent={dayHeader}
              allDaySlot={false}
              slotDuration="00:30:00"
              slotMinHeight={28}
              slotHeaderInterval="01:00:00"
              slotHeaderFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
              scrollTime="09:00:00"
              nowIndicator
              eventInteractive
              editable={Boolean(onDraftChange) && !locked && state === "ready"}
              eventResizableFromStart={false}
              eventDurationEditable={Boolean(onDraftChange) && !locked && state === "ready"}
              events={calendarEvents}
              eventContent={content}
              eventClass="rounded-md border border-border border-l-[3px] focus-visible:outline-2 focus-visible:outline-foreground"
              dayLaneClass={(info) => cn("border-l", info.isDisabled && "bg-muted/50")}
              eventClick={select}
              eventDrop={change}
              eventResize={change}
              datesSet={datesSet}
              todayHint={t(($) => $.schedule.today)}
              prevHint={t(($) => $.schedule.previous)}
              nextHint={t(($) => $.schedule.next)}
              viewHint={(label) => label}
              beforeViews={
                availability && (
                  <p role="status" className="px-5 text-xs text-muted-foreground">
                    {availability.summary}
                  </p>
                )
              }
              toolbarDisabled={locked || state !== "ready"}
              toolbarContent={
                <>
                  <NativeSelect
                    size="sm"
                    value={room}
                    aria-label={t(($) => $.schedule.room)}
                    disabled={locked || !onRoom}
                    onChange={(event) => onRoom?.(event.target.value)}
                    className="w-38 max-w-full"
                  >
                    <NativeSelectOption value="">
                      {t(($) => $.schedule.allRooms)}
                    </NativeSelectOption>
                    {rooms.map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    size="sm"
                    value={instructor}
                    aria-label={t(($) => $.schedule.instructor)}
                    disabled={locked || !onInstructor}
                    onChange={(event) => onInstructor?.(event.target.value)}
                    className="w-38 max-w-full"
                  >
                    <NativeSelectOption value="">
                      {t(($) => $.schedule.allInstructors)}
                    </NativeSelectOption>
                    {instructors.map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </>
              }
            />
          </Suspense>
          {state === "loading" && (
            <p role="status" className="px-5 py-2 text-sm text-muted-foreground">
              {t(($) => $.schedule.loading)}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-3">
          <span className="text-xs text-muted-foreground">{t(($) => $.schedule.keyboardHint)}</span>
          <span className="text-xs text-muted-foreground">{t(($) => $.schedule.draft)}</span>
        </CardFooter>
      </Card>
      {notices.map((notice, index) => (
        <Alert key={index} variant="destructive">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ))}
      {pending > 0 && (
        <Card role="region" aria-label={t(($) => $.schedule.unsaved)} className="sticky bottom-4">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm">
              {t(($) => $.schedule.pending, { count: pending })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onPress={onUndo} isDisabled={locked || !onUndo}>
                {t(($) => $.schedule.undo)}
              </Button>
              <Button onPress={onSave} isDisabled={locked || !onSave}>
                {t(($) => $.schedule.reviewChanges)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
