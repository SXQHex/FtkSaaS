import { useWorkspaceQuery } from "../workspace/workspace-query";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { getTemporal } from "../../lib/temporal";
import { formatMinorAmount } from "../../lib/money";
import {
  instructorPeriod,
  instructorRoomLabel,
  readInstructorCalendar,
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
  const [now, setNow] = useState(() => new Date().toISOString());
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
  const query = useQuery({
    queryKey: [
      "instructor-today",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      center?.timezone,
      weekStart,
      now,
    ],
    enabled,
    retry: false,
    queryFn: async () => {
      const period = await instructorPeriod(center!.timezone, weekStart!, now);
      const entries = await readInstructorCalendar(scope, personId!, period.interval);
      const T = await getTemporal();
      const items = entries.map((row) => ({
        ...row,
        day: T.Instant.from(row.session.starts_at)
          .toZonedDateTimeISO(period.timezone)
          .toPlainDate()
          .toString(),
      }));
      const attendance = new Map<string, Awaited<ReturnType<typeof readInstructorAttendance>>>();
      const today = items.filter((row) => row.day === period.today);
      for (let i = 0; i < today.length; i += 4)
        await Promise.all(
          today.slice(i, i + 4).map(async (row) => {
            attendance.set(row.session.id, await readInstructorAttendance(scope, row.session));
          }),
        );
      return { period, items, attendance };
    },
  });
  const earnings = useQuery({
    queryKey: [
      "instructor-month-earnings",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      query.data?.period.month.starts_at,
    ],
    enabled: enabled && Boolean(query.data) && !query.isError,
    retry: false,
    queryFn: async () => {
      try {
        return {
          status: "available" as const,
          totals: await readInstructorEarnings(scope, personId!, query.data!.period.month),
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
    if (query.error) accessLost(query.error);
    if (earnings.error) accessLost(earnings.error);
  }, [query.error, earnings.error, accessLost]);
  const unknown = t(($) => $.instructorToday.unknown);
  const source = enabled && !query.isError ? query.data : undefined;
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
      Date.parse(row.session.ends_at) > Date.parse(now),
  )?.session.id;
  function rows(items: NonNullable<typeof today>): InstructorSessionRow[] {
    return items.map(({ item, session, day }) => {
      const reading = source?.attendance.get(session.id);
      const attendance = reading?.status === "available" ? reading.attendance : undefined;
      const state =
        session.state === "cancelled"
          ? t(($) => $.instructorToday.states.cancelled)
          : session.attendance_state === "closed"
            ? t(($) => $.instructorToday.states.closed)
            : attendance?.actual_started_at
              ? t(($) => $.instructorToday.states.started)
              : reading && reading.status !== "available"
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
      calendarLoading={enabled && query.isLoading}
      onSchedule={source ? onSchedule : undefined}
      onOpen={source ? onOpen : undefined}
      notice={
        <>
          {(!enabled || query.isError || earnings.isError) && (
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
            isDisabled={!enabled || query.isFetching || earnings.isFetching}
            onPress={() => {
              const next = new Date().toISOString();
              if (next === now) void query.refetch();
              else setNow(next);
              if (query.data && !query.isError) void earnings.refetch();
            }}
          >
            {t(($) => $.instructorToday.retry)}
          </Button>
        </>
      }
    />
  );
}
