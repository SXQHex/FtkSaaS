"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import dynamic from "next/dynamic";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { attendanceTasksApi, type AttendanceTasksApi } from "../../lib/attendance-tasks";
import { calendarInterval, dateInZone, type CalendarRange } from "../../lib/schedule";
import type { SetupScope } from "../../lib/studio-setup";
import { FlowError, flowError } from "../bookings/flow-controls";
const AttendancePanel = dynamic(() => import("./attendance-panel").then((m) => m.AttendancePanel));
export function AttendanceTasks(props: {
  scope: SetupScope;
  timeZone: string;
  api?: AttendanceTasksApi;
}) {
  return <TaskQuery key={JSON.stringify([props.scope, props.timeZone])} {...props} />;
}
function TaskQuery({
  scope: initialScope,
  timeZone,
  api = attendanceTasksApi,
}: {
  scope: SetupScope;
  timeZone: string;
  api?: AttendanceTasksApi;
}) {
  const [scope] = useState(initialScope),
    t = useTranslations("attendance"),
    id = useId();
  const [date, setDate] = useState(() => dateInZone(new Date(), timeZone)),
    [range, setRange] = useState<CalendarRange>("day"),
    [cursor, setCursor] = useState<string>(),
    [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([date, range, cursor, attempt]);
  return (
    <section className="space-y-5" aria-label={t("tasks")}>
      <h2 className="text-lg font-semibold">{t("tasks")}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${id}-date`}>{t("taskDate")}</Label>
          <Input
            id={`${id}-date`}
            type="date"
            value={date}
            required
            onChange={(event) => {
              setCursor(undefined);
              setDate(event.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-range`}>{t("taskRange")}</Label>
          <select
            id={`${id}-range`}
            className="min-h-11 rounded-md border bg-background px-3"
            value={range}
            onChange={(event) => {
              setCursor(undefined);
              setRange(event.target.value === "week" ? "week" : "day");
            }}
          >
            <option value="day">{t("day")}</option>
            <option value="week">{t("week")}</option>
          </select>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setCursor(undefined);
            setAttempt((v) => v + 1);
          }}
        >
          {t("refreshTasks")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{timeZone}</p>
      <TaskResults
        key={key}
        scope={scope}
        timeZone={timeZone}
        date={date}
        range={range}
        cursor={cursor}
        api={api}
        onNext={setCursor}
      />
    </section>
  );
}
function TaskResults({
  scope,
  timeZone,
  date,
  range,
  cursor,
  api,
  onNext,
}: {
  scope: SetupScope;
  timeZone: string;
  date: string;
  range: CalendarRange;
  cursor?: string;
  api: AttendanceTasksApi;
  onNext: (cursor: string) => void;
}) {
  const t = useTranslations("attendance"),
    format = useFormatter();
  const [result, setResult] = useState<{
      page?: Awaited<ReturnType<AttendanceTasksApi["list"]>>;
      error?: string;
    } | null>(null),
    [selected, setSelected] = useState("");
  useEffect(() => {
    const life = new AbortController();
    void Promise.resolve()
      .then(() => api.list(scope, calendarInterval(date, range, timeZone), cursor))
      .then((page) => {
        if (!life.signal.aborted) setResult({ page });
      })
      .catch((cause) => {
        if (!life.signal.aborted) setResult({ error: flowError(cause) });
      });
    return () => life.abort();
  }, [api, scope, timeZone, date, range, cursor]);
  if (!result) return <output aria-live="polite">{t("loadingTasks")}</output>;
  if (result.error) return <FlowError code={result.error} />;
  const page = result.page!;
  return (
    <div className="space-y-5">
      <p>{t("taskPageCount", { count: page.items.length })}</p>
      {!page.items.length && <p>{t("noTasks")}</p>}
      <ul className="space-y-3">
        {page.items.map((row) => (
          <li key={row.id} className="space-y-3 rounded-lg border bg-card p-4">
            <h3 className="font-semibold">{row.title}</h3>
            {selected !== row.id && (
              <p>
                {format.dateTime(new Date(row.starts_at), {
                  timeZone,
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                — {format.dateTime(new Date(row.ends_at), { timeZone, timeStyle: "short" })}
              </p>
            )}
            <Button
              variant="outline"
              aria-expanded={selected === row.id}
              className="h-auto min-h-11 whitespace-normal"
              onClick={() => setSelected((current) => (current === row.id ? "" : row.id))}
            >
              {t(selected === row.id ? "hideTask" : "openTask", { title: row.title })}
            </Button>
            {selected === row.id && (
              <AttendancePanel key={row.id} scope={scope} sessionId={row.id} timeZone={timeZone} />
            )}
          </li>
        ))}
      </ul>
      {page.next_cursor && (
        <Button variant="outline" onClick={() => onNext(page.next_cursor!)}>
          {t("nextTasks")}
        </Button>
      )}
    </div>
  );
}
