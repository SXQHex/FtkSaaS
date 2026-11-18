import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { Interval } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { instructorPeriod, instructorRoomLabel, readInstructorCalendar } from "./instructor-read";
import { useInstructorScope } from "./use-instructor-scope";
import { InstructorScheduleView } from "./instructor-schedule-view";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
export function InstructorScheduleContent({
  scope,
  weekStart,
  onOpen,
}: {
  scope: ClientScope;
  weekStart?: "monday" | "sunday";
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation(),
    router = useRouter();
  const { center, identity, self } = useInstructorScope(scope);
  const personId = self?.instructor ? identity?.person_id : undefined;
  const [now] = useState(() => new Date().toISOString());
  const [range, setRange] = useState<Interval>();
  const period = useQuery({
    queryKey: [
      "instructor-week",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      center?.timezone,
      weekStart,
      now,
    ],
    queryFn: () => instructorPeriod(center!.timezone, weekStart!, now),
    enabled: Boolean(center && personId && weekStart),
    retry: false,
  });
  const interval = range ?? period.data?.interval;
  const query = useQuery({
    queryKey: [
      "instructor-schedule",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      interval?.starts_at,
      interval?.ends_at,
    ],
    queryFn: () => readInstructorCalendar(scope, personId!, interval!),
    enabled: Boolean(center && personId && weekStart && range),
    retry: false,
  });
  const onRange = useCallback(
    (next: Interval) =>
      setRange((old) =>
        old?.starts_at === next.starts_at && old.ends_at === next.ends_at ? old : next,
      ),
    [],
  );
  useEffect(() => {
    for (const error of [period.error, query.error])
      if (
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      )
        void router.invalidate();
  }, [period.error, query.error, router]);
  if (center && personId && weekStart && period.isPending)
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">{t(($) => $.instructorSchedule.title)}</h1>
        <p>{t(($) => $.instructorSchedule.loading)}</p>
      </div>
    );
  if (!center || !personId || !weekStart || !period.data || period.isError)
    return (
      <div className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold">{t(($) => $.instructorSchedule.title)}</h1>
        <Alert variant="destructive">
          <AlertDescription>
            {!center || !weekStart
              ? t(($) => $.instructorToday.chooseScope)
              : !personId
                ? t(($) => $.instructorToday.unavailable)
                : t(($) => $.instructorToday.unread)}
          </AlertDescription>
        </Alert>
      </div>
    );
  const entries = !query.isError ? query.data : undefined;
  const formatter = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeZone: center.timezone,
  });
  const summary = entries
    ? t(($) => $.instructorSchedule.summary, {
        sessions: entries.filter((row) => row.session.state !== "cancelled").length,
        hours: new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(
          entries
            .filter((row) => row.session.state !== "cancelled")
            .reduce(
              (sum, row) =>
                sum + Date.parse(row.session.ends_at) - Date.parse(row.session.starts_at),
              0,
            ) / 3600000,
        ),
      })
    : t(($) => $.instructorToday.unknown);
  return (
    <InstructorScheduleView
      key={`${center.timezone}:${weekStart}`}
      timezone={center.timezone}
      initialDate={period.data.today}
      weekStart={weekStart}
      now={now}
      range={
        interval
          ? formatter.formatRange(
              new Date(interval.starts_at),
              new Date(Date.parse(interval.ends_at) - 1),
            )
          : t(($) => $.instructorToday.unknown)
      }
      summary={summary}
      events={
        entries?.map(({ item, session }) => ({
          id: session.id,
          title: [
            item.title,
            instructorRoomLabel(
              session,
              t(($) => $.instructorToday.roomUnread),
              t(($) => $.instructorToday.roomUnassigned),
            ),
            session.state === "cancelled" ? t(($) => $.instructorToday.states.cancelled) : "",
          ]
            .filter(Boolean)
            .join(" · "),
          start: session.starts_at,
          end: session.ends_at,
          status:
            session.state === "cancelled"
              ? t(($) => $.instructorToday.states.cancelled)
              : session.attendance_state === "closed"
                ? t(($) => $.instructorToday.states.closed)
                : t(($) => $.schedule.sessionStates[session.state]),
        })) ?? []
      }
      state={query.isError ? "error" : query.isPending ? "pending" : "ready"}
      onRange={onRange}
      onOpen={onOpen}
      notice={
        <>
          {query.isError && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.instructorToday.unread)}</AlertDescription>
            </Alert>
          )}
          <Button
            variant="outline"
            isDisabled={query.isFetching}
            onPress={() => {
              void query.refetch();
            }}
          >
            {t(($) => $.instructorToday.retry)}
          </Button>
        </>
      }
    />
  );
}
