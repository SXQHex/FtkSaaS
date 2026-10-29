"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Badge } from "@ftksaas/ui/components/badge";
import { cn } from "@ftksaas/ui/lib/utils";
import {
  addDays,
  dateInZone,
  entryKey,
  weekStart,
  type CalendarEntry,
  type CalendarRange,
} from "../../lib/schedule";

const SchedulerEngine = dynamic(() => import("./scheduler-engine"), {
  ssr: false,
  loading: () => <CalendarLoading />,
});
function CalendarLoading() {
  const t = useTranslations("calendar");
  return (
    <output className="block p-10 text-center text-sm text-muted-foreground" aria-live="polite">
      {t("loading")}
    </output>
  );
}
export type SessionCalendarProps = {
  date: string;
  range: CalendarRange;
  timeZone: string;
  entries: CalendarEntry[];
  loading?: boolean;
  error?: string;
  onDateChange: (date: string) => void;
  onRangeChange: (range: CalendarRange) => void;
  onSelect: (entry: CalendarEntry) => void;
  onRefresh?: () => void;
  today?: string;
};

export function SessionCalendar({
  date,
  range,
  timeZone,
  entries,
  loading,
  error,
  onDateChange,
  onRangeChange,
  onSelect,
  onRefresh,
  today,
}: SessionCalendarProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const licensed = Boolean(process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY);
  const formatDay = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
      new Date(`${day}T12:00:00Z`),
    );
  const formatTime = (instant: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(instant));
  const start = weekStart(date);
  const visible = entries.filter(
    (entry) =>
      (kind === "all" || entry.kind === kind) &&
      entry.title.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale).trim()),
  );
  const days =
    range === "day" ? [date] : Array.from({ length: 7 }, (_, index) => addDays(start, index));
  return (
    <section aria-label={t("label")} className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {formatDay(date, { month: "long", year: "numeric" })}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{timeZone}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("previous")}
            onClick={() => onDateChange(addDays(date, range === "week" ? -7 : -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            onClick={() => onDateChange(today ?? dateInZone(new Date(), timeZone))}
          >
            {t("today")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("next")}
            onClick={() => onDateChange(addDays(date, range === "week" ? 7 : 1))}
          >
            <ChevronRight />
          </Button>
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              disabled={loading}
              aria-label={t("refresh")}
              onClick={onRefresh}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
          )}
        </div>
      </div>
      <div
        className="grid grid-cols-7 gap-1 rounded-xl border bg-card p-1.5"
        aria-label={t("chooseDay")}
      >
        {Array.from({ length: 7 }, (_, index) => {
          const day = addDays(start, index);
          const weekday = formatDay(day, { weekday: "short" });
          const number = formatDay(day, { day: "numeric" });
          return (
            <button
              key={day}
              type="button"
              aria-pressed={day === date}
              aria-label={`${weekday} ${number}`}
              aria-describedby={`calendar-date-${day}`}
              onClick={() => onDateChange(day)}
              className={cn(
                "flex min-h-17 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 hover:bg-muted",
                day === date && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              <span className="text-[11px] sm:text-xs">{weekday}</span>
              <span className="text-base font-semibold tabular-nums">{number}</span>
              <span id={`calendar-date-${day}`} className="sr-only">
                {formatDay(day, { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset
          className="flex min-w-0 flex-wrap gap-1 rounded-lg border bg-card p-1"
          aria-label={t("range")}
        >
          {(["day", "week"] as const).map((value) => (
            <Button
              key={value}
              variant={range === value ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={range === value}
              onClick={() => onRangeChange(value)}
            >
              {t(value)}
            </Button>
          ))}
        </fieldset>
        <div className="relative min-w-0 flex-1 sm:max-w-72">
          <Search
            className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="min-h-11 pl-9"
            aria-label={t("search")}
            placeholder={t("search")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {licensed && (
          <fieldset
            className="flex min-w-0 gap-1 rounded-lg border bg-card p-1"
            aria-label={t("layout")}
          >
            <Button
              size="icon"
              variant={layout === "list" ? "secondary" : "ghost"}
              aria-label={t("list")}
              aria-pressed={layout === "list"}
              onClick={() => setLayout("list")}
            >
              <List />
            </Button>
            <Button
              size="icon"
              variant={layout === "grid" ? "secondary" : "ghost"}
              aria-label={t("grid")}
              aria-pressed={layout === "grid"}
              onClick={() => setLayout("grid")}
            >
              <CalendarDays />
            </Button>
          </fieldset>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        {(entries.some((entry) => entry.kind === "event") || kind !== "all") && (
          <fieldset className="flex min-w-0 flex-wrap gap-2" aria-label={t("filter")}>
            {["all", "session", "event"].map((value) => (
              <Button
                key={value}
                variant={kind === value ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
              >
                {t(value)}
              </Button>
            ))}
          </fieldset>
        )}
        {!loading && !error && (
          <output aria-live="polite" className="text-xs text-muted-foreground">
            {t("count", { count: visible.length })}
          </output>
        )}
      </div>
      {loading ? (
        <CalendarLoading />
      ) : error ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-6">
          <h3 className="font-medium">{t("loadFailed")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          {onRefresh && (
            <Button variant="outline" className="mt-4" onClick={onRefresh}>
              {t("retry")}
            </Button>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-5 py-12 text-center">
          <CalendarDays className="mx-auto mb-4 size-8 text-muted-foreground" aria-hidden="true" />
          <h3 className="font-medium">{t(query || kind !== "all" ? "noResults" : "empty")}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {t(query || kind !== "all" ? "noResultsHint" : "emptyHint")}
          </p>
          {(query || kind !== "all") && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setQuery("");
                setKind("all");
              }}
            >
              {t("clearFilters")}
            </Button>
          )}
        </div>
      ) : layout === "grid" && licensed ? (
        <SchedulerEngine
          date={date}
          range={range}
          timeZone={timeZone}
          entries={visible}
          onSelect={onSelect}
        />
      ) : (
        <div className="space-y-6">
          {days.map((day) => {
            const dayItems = visible.filter(
              (entry) =>
                dateInZone(new Date(entry.startsAt), timeZone) <= day &&
                dateInZone(new Date(new Date(entry.endsAt).getTime() - 1), timeZone) >= day,
            );
            if (!dayItems.length) return null;
            return (
              <section key={day} aria-label={formatDay(day, { dateStyle: "full" })}>
                <h3 className="mb-3 text-sm font-medium">
                  {formatDay(day, { weekday: "long", day: "numeric", month: "long" })}
                </h3>
                <div className="space-y-3">
                  {dayItems.map((entry) => (
                    <button
                      key={entryKey(entry)}
                      type="button"
                      onClick={() => onSelect(entry)}
                      className="group flex w-full flex-wrap items-center gap-4 rounded-xl border bg-card p-5 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40"
                    >
                      <div className="flex min-w-24 items-baseline gap-2 sm:block">
                        <span className="block text-lg font-semibold tabular-nums">
                          {formatTime(entry.startsAt)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(entry.endsAt)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 basis-40">
                        <span className="mb-2 inline-block text-xs text-muted-foreground">
                          {t(entry.kind)}
                        </span>
                        <h4 className="font-semibold">{entry.title}</h4>
                        {dateInZone(new Date(entry.startsAt), timeZone) !==
                          dateInZone(new Date(entry.endsAt), timeZone) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            <Clock3 className="mr-1 inline size-3" aria-hidden="true" />
                            {t("ends", {
                              date: new Intl.DateTimeFormat(locale, {
                                timeZone,
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(entry.endsAt)),
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex max-w-full items-center gap-3">
                        {entry.capacity && (
                          <Badge variant="outline" className="gap-1.5">
                            <Users className="size-3" aria-hidden="true" />
                            {t("remaining", { count: entry.capacity.remaining })}
                          </Badge>
                        )}
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
