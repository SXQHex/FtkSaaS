import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { getTemporal } from "../../lib/temporal";
import { useInstructorScope } from "./use-instructor-scope";
import { readInstructorSession, instructorRoomLabel } from "./instructor-read";
import { InstructorSessionView } from "./instructor-session-view";
import { SessionAttendanceController } from "../session-detail/session-attendance-controller";
import { scheduleInterval, ScheduleTimeError } from "../schedule/schedule-time";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Field, FieldLabel, FieldError } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
export function InstructorSessionContent({
  scope,
  sessionId,
  onBack,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  sessionId: string;
  onBack: () => void;
  onLockChange: (value: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient();
  const { center, identity, self } = useInstructorScope(scope, preservePending);
  const duties: ("instructor" | "assistant")[] = [];
  if (self?.instructor) duties.push("instructor");
  if (self?.assistant) duties.push("assistant");
  const personId = duties.length ? identity?.person_id : undefined;
  const prefix = [
    "instructor-session",
    scope.accountId,
    scope.orgId,
    scope.centerId,
    personId,
    sessionId,
  ];
  const query = useQuery({
    queryKey: prefix,
    queryFn: () => readInstructorSession(scope, personId!, duties, sessionId),
    enabled: Boolean(center && personId),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [locked, setLocked] = useState(false),
    [day, setDay] = useState(""),
    [time, setTime] = useState(""),
    [offset, setOffset] = useState("");
  const timezone = center?.timezone;
  const wallKey = `${timezone ?? ""}|${day}|${time}`;
  const draftKey = `${wallKey}|${offset}`;
  const [startResult, setStartResult] = useState<{
    key: string;
    wallKey?: string;
    startAt?: string;
    choices?: { id: string; label: string }[];
    error?: string;
  }>();
  const currentStart = startResult?.key === draftKey ? startResult : undefined;
  const startAt = currentStart?.startAt,
    choices = startResult?.wallKey === wallKey ? (startResult.choices ?? []) : [],
    timeError = currentStart?.error;
  const accessLost = useCallback(
    (error: unknown) => {
      if (
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        queries.removeQueries({ queryKey: ["instructor-session", scope.accountId] });
        void router.invalidate();
        return true;
      }
      return false;
    },
    [queries, router, scope.accountId],
  );
  useEffect(() => {
    if (query.error) accessLost(query.error);
  }, [query.error, accessLost]);
  useEffect(() => {
    let active = true;
    if (timezone && !day)
      void getTemporal()
        .then((T) => {
          if (!active) return;
          const local = T.Instant.from(new Date().toISOString()).toZonedDateTimeISO(timezone);
          setDay(local.toPlainDate().toString());
          setTime(local.toPlainTime().toString({ smallestUnit: "minute" }));
        })
        .catch(() => {
          if (active) setStartResult({ key: draftKey, error: t(($) => $.lessonRequests.invalid) });
        });
    return () => {
      active = false;
    };
  }, [timezone, day, draftKey, t]);
  useEffect(() => {
    let active = true;
    if (timezone && day && time)
      void scheduleInterval(timezone, day, time, 1, offset)
        .then((interval) => {
          if (active)
            setStartResult((previous) => ({
              key: draftKey,
              wallKey,
              startAt: interval.starts_at,
              choices: previous?.wallKey === wallKey ? previous.choices : undefined,
            }));
        })
        .catch((error) => {
          if (!active) return;
          if (error instanceof ScheduleTimeError && error.message === "SCHEDULE_TIME_AMBIGUOUS")
            setStartResult({
              key: draftKey,
              wallKey,
              choices: error.requests[0]?.choices ?? [],
              error: t(($) => $.lessonRequests.offsetRequired),
            });
          else setStartResult({ key: draftKey, error: t(($) => $.lessonRequests.invalid) });
        });
    return () => {
      active = false;
    };
  }, [timezone, day, time, offset, draftKey, wallKey, t]);
  const lock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  const source = (center && personId) || preservePending ? query.data : undefined;
  const { refetch } = query;
  const refresh = useCallback(async () => {
    const result = await refetch({ throwOnError: true });
    if (!result.data) throw new Error("INSTRUCTOR_SESSION_UNAVAILABLE");
    await Promise.all([
      queries.invalidateQueries({
        queryKey: ["instructor-today", scope.accountId, scope.orgId, scope.centerId],
      }),
      queries.invalidateQueries({
        queryKey: ["instructor-schedule", scope.accountId, scope.orgId, scope.centerId],
      }),
      queries.invalidateQueries({
        queryKey: ["instructor-month-earnings", scope.accountId, scope.orgId, scope.centerId],
      }),
    ]);
  }, [refetch, queries, scope.accountId, scope.orgId, scope.centerId]);
  const error = !center || !personId || query.isError;
  const retry = (
    <Button
      variant="outline"
      isDisabled={locked || query.isFetching || !center || !personId}
      onPress={() => {
        void query.refetch();
      }}
    >
      {t(($) => $.instructorSession.retry)}
    </Button>
  );
  if (!source || !center)
    return (
      <div className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold">{t(($) => $.instructorSession.title)}</h1>
        <Alert variant="destructive">
          <AlertDescription>{t(($) => $.instructorSession.sourceError)}</AlertDescription>
        </Alert>
        {retry}
      </div>
    );
  const attendance =
    source.attendance.status === "available" && !query.isError
      ? source.attendance.attendance
      : undefined;
  const fmt = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: center.timezone,
  });
  return (
    <SessionAttendanceController
      key={`${personId}:${sessionId}`}
      scope={scope}
      audience="instructor"
      startTime={startAt}
      session={source.session}
      attendance={attendance}
      names={source.names}
      instructors={source.session.assignments
        .filter((row) => row.duty === "instructor")
        .map((row) => ({
          id: row.person_id,
          name: source.names.get(row.person_id) ?? t(($) => $.instructorToday.unknown),
        }))}
      timezone={center.timezone}
      disabled={error}
      onLockChange={lock}
      onAccessLost={accessLost}
      onRefresh={refresh}
      onRetry={() => {
        void query.refetch();
      }}
    >
      {(ui) => (
        <InstructorSessionView
          title={source.header.title}
          subtitle={fmt.format(new Date(source.session.starts_at))}
          badges={[
            t(($) => $.schedule.sessionStates[source.session.state]),
            t(($) =>
              source.session.attendance_state === "open"
                ? $.sessionDetail.open
                : $.sessionDetail.closed,
            ),
          ]}
          facts={[
            {
              label: t(($) => $.instructorSession.planned),
              value: fmt.format(new Date(source.session.starts_at)),
            },
            {
              label: t(($) => $.instructorSession.actual),
              value: attendance?.actual_started_at
                ? fmt.format(new Date(attendance.actual_started_at))
                : attendance
                  ? t(($) => $.instructorSession.notStarted)
                  : t(($) => $.instructorSession.unknown),
            },
            {
              label: t(($) => $.instructorSession.room),
              value: instructorRoomLabel(
                source.session,
                t(($) => $.instructorToday.roomUnread),
                t(($) => $.instructorToday.roomUnassigned),
              ),
            },
            {
              label: t(($) => $.instructorSession.members),
              value: String(source.session.capacity.held),
            },
          ]}
          timezone={t(($) => $.instructorToday.timezone, { timezone: center.timezone })}
          locked={locked}
          onBack={onBack}
          onStart={ui.onStart}
          startEditor={
            attendance &&
            source.session.state === "planned" &&
            !attendance.actual_started_at &&
            attendance.closure_state === "open" ? (
              <div className="grid min-w-0 grid-cols-1 gap-4 @lg:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="actual-day">
                    {t(($) => $.instructorSession.actualDay)}
                  </FieldLabel>
                  <Input
                    id="actual-day"
                    type="date"
                    value={day}
                    disabled={locked}
                    onChange={(event) => {
                      setOffset("");
                      setDay(event.target.value);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="actual-time">
                    {t(($) => $.instructorSession.actualTime)}
                  </FieldLabel>
                  <Input
                    id="actual-time"
                    type="time"
                    value={time}
                    disabled={locked}
                    aria-invalid={Boolean(timeError)}
                    aria-describedby="actual-time-error"
                    onChange={(event) => {
                      setOffset("");
                      setTime(event.target.value);
                    }}
                  />
                  <FieldError id="actual-time-error">{timeError}</FieldError>
                </Field>
                {choices.length > 0 && (
                  <Field>
                    <FieldLabel htmlFor="actual-offset">
                      {t(($) => $.lessonRequests.offset)}
                    </FieldLabel>
                    <NativeSelect
                      id="actual-offset"
                      value={offset}
                      disabled={locked}
                      onChange={(event) => setOffset(event.target.value)}
                    >
                      <NativeSelectOption value="">
                        {t(($) => $.lessonRequests.choose)}
                      </NativeSelectOption>
                      {choices.map((row) => (
                        <NativeSelectOption key={row.id} value={row.id}>
                          {row.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
              </div>
            ) : undefined
          }
          attendance={ui.panel}
          overlays={ui.overlays}
          notice={
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{t(($) => $.instructorSession.sourceError)}</AlertDescription>
                </Alert>
              )}
              {retry}
            </>
          }
        />
      )}
    </SessionAttendanceController>
  );
}
