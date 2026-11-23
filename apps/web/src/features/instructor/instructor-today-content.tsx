import { useWorkspaceQuery } from "../workspace/workspace-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { instructorCalendarQuery } from "./instructor-query";
import { scheduleCacheKeys } from "../schedule/schedule-cache";
import { formatMinorAmount } from "../../lib/money";
import {
  instructorPeriod,
  instructorRoomLabel,
  readInstructorEarnings,
  readInstructorAttendance,
  instructorReadStatus,
} from "./instructor-read";
import {
  InstructorTodayView,
  type InstructorTodayData,
  type InstructorSessionRow,
} from "./instructor-today-view";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";

export function InstructorTodayContent({
  scope,
  weekStart,
  onSchedule,
  onOpen,
}: {
  scope: ClientScope;
  weekStart?: "monday" | "sunday";
  onSchedule?: () => void;
  onOpen?: (id: string) => void;
}) {
  const { t } = useTranslation(),
    router = useRouter();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const workspace = useWorkspaceQuery(scope.accountId, scope.orgId, false);
  const current =
    !workspace.isError && workspace.data?.selected?.id === scope.orgId ? workspace.data : undefined;
  const center = current?.centers.find((row) => row.id === scope.centerId && row.accessible);
  const identity = current?.selected?.self_context;
  const personId = identity?.centers.some(
    (row) => row.center_id === scope.centerId && row.instructor,
  )
    ? identity.person_id
    : undefined;
  const enabled = Boolean(center && personId && weekStart);
  const timezone = center?.timezone;
  const localDate = useMemo(
    () =>
      center
        ? new Intl.DateTimeFormat("sv-SE", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone: center.timezone,
          })
        : undefined,
    [center],
  );
  const dateKey = localDate?.format(now);
  const period = useQuery({
    queryKey: ["instructor-day", timezone, weekStart, dateKey],
    queryFn: () => instructorPeriod(timezone!, weekStart!, new Date(now).toISOString()),
    enabled,
    retry: false,
    staleTime: Infinity,
  });
  const query = useQuery({
    ...instructorCalendarQuery(scope, personId, period.data?.interval),
    enabled: enabled && !!period.data && !period.isError,
  });
  const calendar = query.isError ? undefined : query.data;
  const items = useMemo(
    () =>
      calendar?.map((row) => ({
        ...row,
        day: localDate?.format(new Date(row.session.starts_at)) ?? "",
      })),
    [calendar, localDate],
  );
  const localToday = period.data?.today;
  const todayItems = items?.filter((row) => row.day === localToday);
  const attendanceQuery = useQuery({
    queryKey: [
      ...scheduleCacheKeys.instructorAttendance(scope),
      personId,
      todayItems?.map(({ session }) => [session.id, session.version, session.attendance_state]),
    ],
    enabled: enabled && !!todayItems?.length && !query.isError && !period.isError,
    retry: false,
    queryFn: async (readContext) => {
      const readings = new Map<string, Awaited<ReturnType<typeof readInstructorAttendance>>>();
      for (let index = 0; index < todayItems!.length; index += 4)
        await Promise.all(
          todayItems!.slice(index, index + 4).map(async ({ session }) => {
            readings.set(session.id, await readInstructorAttendance(scope, session, readContext));
          }),
        );
      return readings;
    },
  });
  const earnings = useQuery({
    queryKey: [
      "instructor-month-earnings",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      period.data?.month.starts_at,
    ],
    enabled: enabled && !!period.data && !period.isError && !!calendar,
    retry: false,
    queryFn: async (readContext) => {
      try {
        return {
          status: "available" as const,
          totals: await readInstructorEarnings(scope, personId!, period.data!.month, readContext),
        };
      } catch (error) {
        return { status: instructorReadStatus(error) };
      }
    },
  });
  const accessLost = useCallback(
    (error: unknown) => {
      if (
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      )
        void router.invalidate();
    },
    [router],
  );
  useEffect(() => {
    for (const error of [query.error, attendanceQuery.error, earnings.error])
      if (error) accessLost(error);
  }, [query.error, attendanceQuery.error, earnings.error, accessLost]);
  const unknown = t(($) => $.instructorToday.unknown);
  const source =
    enabled && period.data && !period.isError && items ? { period: period.data, items } : undefined;
  const time = center
    ? new Intl.DateTimeFormat("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: center.timezone,
      })
    : undefined;
  const date = center
    ? new Intl.DateTimeFormat("tr-TR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: center.timezone,
      }).format(new Date(now))
    : unknown;
  const month = center
    ? new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: center.timezone }).format(
        new Date(now),
      )
    : unknown;
  const today = source?.items.filter((row) => row.day === source.period.today);
  const next = source?.items.filter((row) => row.day > source.period.today);
  const currentId = today?.find(
    (row) =>
      row.session.state !== "cancelled" &&
      row.session.attendance_state === "open" &&
      Date.parse(row.session.ends_at) > now,
  )?.session.id;
  function rows(items: NonNullable<typeof today>): InstructorSessionRow[] {
    return items.map(({ item, session, day }) => {
      const reading = !attendanceQuery.isError ? attendanceQuery.data?.get(session.id) : undefined;
      const attendance = reading?.status === "available" ? reading.attendance : undefined;
      const state =
        session.state === "cancelled"
          ? t(($) => $.instructorToday.states.cancelled)
          : session.attendance_state === "closed"
            ? t(($) => $.instructorToday.states.closed)
            : attendance?.actual_started_at
              ? t(($) => $.instructorToday.states.started)
              : day === localToday && reading?.status !== "available"
                ? t(($) => $.instructorToday.attendanceUnread)
                : t(($) => $.instructorToday.states.planned);
      return {
        id: session.id,
        title: item.title,
        time: time!.format(new Date(session.starts_at)),
        duration: t(($) => $.instructorToday.minutes, {
          count: (Date.parse(session.ends_at) - Date.parse(session.starts_at)) / 60000,
        }),
        context: [
          instructorRoomLabel(
            session,
            t(($) => $.instructorToday.roomUnread),
            t(($) => $.instructorToday.roomUnassigned),
          ),
          center!.name,
          t(($) => $.instructorToday.members, { count: session.capacity.held }),
          day === source?.period.today
            ? ""
            : new Intl.DateTimeFormat("tr-TR", {
                weekday: "long",
                timeZone: center!.timezone,
              }).format(new Date(session.starts_at)),
        ]
          .filter(Boolean)
          .join(" · "),
        state,
        current: session.id === currentId,
        closed: session.attendance_state === "closed" || session.state === "cancelled",
        action:
          attendance?.actual_started_at && attendance.closure_state === "open"
            ? t(($) => $.instructorToday.attendance)
            : session.attendance_state === "closed"
              ? t(($) => $.instructorToday.view)
              : t(($) => $.instructorToday.open),
      };
    });
  }
  const pending = today?.filter(
    (row) => row.session.state !== "cancelled" && row.session.attendance_state === "open",
  ).length;
  const week = source?.items.filter(
    (row) =>
      Date.parse(row.session.starts_at) >= Date.parse(source.period.interval.starts_at) &&
      row.session.state !== "cancelled",
  );
  const availableEarnings = source && !earnings.isError ? earnings.data : undefined;
  const data: InstructorTodayData = {
    date,
    timezone: center
      ? t(($) => $.instructorToday.timezone, { timezone: center.timezone })
      : unknown,
    attendanceHint: t(($) => $.instructorToday.attendanceHint),
    metrics: {
      today: {
        value: today
          ? t(($) => $.instructorToday.sessions, {
              count: today.filter((row) => row.session.state !== "cancelled").length,
            })
          : null,
        detail:
          today === undefined
            ? unknown
            : today.length
              ? `${time!.format(new Date(today[0]!.session.starts_at))} – ${time!.format(new Date(today.at(-1)!.session.ends_at))}`
              : t(($) => $.instructorToday.empty.today),
      },
      pending: {
        value: pending === undefined ? null : String(pending),
        detail: t(($) => $.instructorToday.openAttendanceCount),
      },
      week: {
        value: week ? t(($) => $.instructorToday.sessions, { count: week.length }) : null,
        detail: week
          ? t(($) => $.instructorToday.hours, {
              hours: new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(
                week.reduce(
                  (sum, row) =>
                    sum + Date.parse(row.session.ends_at) - Date.parse(row.session.starts_at),
                  0,
                ) / 3600000,
              ),
            })
          : unknown,
      },
      earnings: {
        label: t(($) => $.instructorToday.earnings, { month }),
        value:
          availableEarnings?.status === "available"
            ? availableEarnings.totals
                .map((row) => formatMinorAmount(row.amount, row.currency))
                .join(" · ") || t(($) => $.instructorToday.noEarnings)
            : null,
        detail:
          availableEarnings?.status === "restricted"
            ? t(($) => $.instructorToday.restricted)
            : availableEarnings?.status === "not_enabled"
              ? t(($) => $.instructorToday.notEnabled)
              : t(($) => $.instructorToday.earningsHint),
      },
    },
    today: today ? rows(today) : null,
    next: next ? rows(next) : null,
  };
  return (
    <InstructorTodayView
      data={data}
      calendarLoading={enabled && (query.isLoading || period.isLoading)}
      onSchedule={source ? onSchedule : undefined}
      onOpen={source ? onOpen : undefined}
      notice={
        <>
          {(!enabled ||
            query.isError ||
            period.isError ||
            attendanceQuery.isError ||
            earnings.isError) && (
            <Alert variant="destructive">
              <AlertDescription>
                {!center || !weekStart
                  ? t(($) => $.instructorToday.chooseScope)
                  : !personId
                    ? t(($) => $.instructorToday.unavailable)
                    : t(($) => $.instructorToday.unread)}
              </AlertDescription>
            </Alert>
          )}
          <Button
            variant="outline"
            isDisabled={
              !enabled || query.isFetching || attendanceQuery.isFetching || earnings.isFetching
            }
            onPress={() => {
              const next = Date.now();
              setNow(next);
              if (localDate?.format(next) !== dateKey) return;
              if (period.isError) void period.refetch();
              else void query.refetch();
              if (todayItems?.length) void attendanceQuery.refetch();
              if (calendar && period.data) void earnings.refetch();
            }}
          >
            {t(($) => $.instructorToday.retry)}
          </Button>
        </>
      }
    />
  );
}
