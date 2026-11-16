import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SessionDetailView, SessionParticipants } from "./session-detail-view";
import { SessionWaitlistController } from "./session-waitlist-controller";
import { SessionAttendanceController } from "./session-attendance-controller";
import { SessionBookingEditor } from "./session-booking-editor";
import {
  readSessionParticipants,
  readSessionAttendance,
  readSessionInstructors,
  readSessionHeader,
} from "./session-detail-read";
import { readScheduleSession } from "../schedule/schedule-read";
import { readStudioResource } from "../studio/studio";
import { readWorkspace } from "../workspace/workspace";
import { readPeoplePage } from "../people/people";
import { CancelReservation } from "../member-profile/cancel-reservation";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";
import { Field, FieldLabel } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";

export function SessionDetailContent({
  scope,
  sessionId,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  sessionId: string;
  onLockChange: (value: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    navigate = useNavigate(),
    queries = useQueryClient();
  const [invalid, setInvalid] = useState(false),
    [booking, setBooking] = useState(false),
    [bookingLocked, setBookingLocked] = useState(false),
    [cancelLocked, setCancelLocked] = useState(false),
    [waitlistLocked, setWaitlistLocked] = useState(false),
    [attendanceLocked, setAttendanceLocked] = useState(false);
  const locked = bookingLocked || cancelLocked || attendanceLocked || waitlistLocked;
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState<string>();
  const [person, setPerson] = useState<{ id: string; name: string }>(),
    [peopleCursors, setPeopleCursors] = useState<(string | undefined)[]>([undefined]),
    [peoplePage, setPeoplePage] = useState(0);
  const [cancel, setCancel] = useState<{ id: string; personId: string; name: string }>();
  const prefix = ["session-detail", scope.accountId, scope.orgId, scope.centerId, sessionId];
  const accessLost = useCallback(
    (failure: unknown) => {
      const code =
        failure instanceof BackendError
          ? failure.code
          : failure instanceof Error
            ? failure.message
            : undefined;
      if (!code || !["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED"].includes(code))
        return false;
      setInvalid(true);
      queries.removeQueries({
        queryKey: ["session-detail", scope.accountId, scope.orgId, scope.centerId],
      });
      void router.invalidate();
      return true;
    },
    [queries, router, scope.accountId, scope.orgId, scope.centerId],
  );
  async function guardedRead<T>(read: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch (failure) {
      accessLost(failure);
      throw failure;
    }
  }
  const workspace = useQuery({
    queryKey: ["workspace", scope.accountId, scope.orgId],
    queryFn: () => guardedRead(() => readWorkspace(scope.accountId, scope.orgId)),
    retry: false,
  });
  const center = !workspace.isError
    ? workspace.data?.centers.find((row) => row.id === scope.centerId && row.accessible)
    : undefined;
  const session = useQuery({
    queryKey: [...prefix, "session"],
    queryFn: () => guardedRead(() => readScheduleSession(scope, sessionId)),
    enabled: Boolean(center && !invalid),
    retry: false,
  });
  const native = !session.isError ? session.data : undefined;
  const header = useQuery({
    queryKey: [...prefix, "header", native?.version],
    queryFn: () => guardedRead(() => readSessionHeader(scope, native!)),
    enabled: Boolean(native && !invalid && center),
    retry: false,
  });
  const rooms = useQuery({
    queryKey: [...prefix, "rooms", native?.version],
    queryFn: () =>
      guardedRead(() =>
        Promise.all(
          (header.data?.resources?.filter((row) => row.kind === "room") ?? []).map((row) =>
            readStudioResource(scope, "room", row.id),
          ),
        ),
      ),
    enabled: Boolean(header.data && !header.isError && !invalid && center),
    retry: false,
  });
  const instructors = useQuery({
    queryKey: [...prefix, "instructors", native?.version],
    queryFn: () => guardedRead(() => readSessionInstructors(scope, sessionId)),
    enabled: Boolean(native && center && !invalid),
    retry: false,
  });
  const reservations = useQuery({
    queryKey: [...prefix, "participants", person?.id, cursors[page]],
    queryFn: () =>
      guardedRead(() => readSessionParticipants(scope, sessionId, person?.id, cursors[page])),
    enabled: Boolean(native && center && !invalid),
    retry: false,
  });
  const attendance = useQuery({
    queryKey: [...prefix, "attendance", native?.version],
    queryFn: () => guardedRead(() => readSessionAttendance(scope, sessionId)),
    enabled: Boolean(native && center && !invalid),
    retry: false,
  });
  const people = useQuery({
    queryKey: [...prefix, "search", query, peopleCursors[peoplePage]],
    queryFn: () => guardedRead(() => readPeoplePage(scope, query!, peopleCursors[peoplePage])),
    enabled: query !== undefined && Boolean(center && !invalid),
    retry: false,
  });
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const refresh = useCallback(async () => {
    await queries.invalidateQueries({
      queryKey: ["session-detail", scope.accountId, scope.orgId, scope.centerId, sessionId],
      refetchType: "active",
    });
    // Scheduling and member views share domain effects, not private UI state.
    await queries.invalidateQueries({
      queryKey: ["schedule-range", scope.accountId, scope.orgId, scope.centerId],
      refetchType: "none",
    });
    await queries.invalidateQueries({
      queryKey: ["profile-reservations", scope.accountId, scope.orgId, scope.centerId],
      refetchType: "none",
    });
  }, [queries, scope.accountId, scope.orgId, scope.centerId, sessionId]);
  if (invalid)
    return (
      <Alert variant="destructive">
        <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
      </Alert>
    );
  if (session.isError || (!center && !preservePending && !workspace.isPending))
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>{t(($) => $.sessionDetail.readFailed)}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onPress={() => {
            void workspace.refetch();
            void session.refetch();
          }}
        >
          {t(($) => $.sessionDetail.retry)}
        </Button>
      </div>
    );
  if (!native)
    return (
      <div className="flex flex-col gap-4 p-6">
        <p role="status">{t(($) => $.sessionDetail.loading)}</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-80" />
      </div>
    );
  const unknown = t(($) => $.sessionDetail.unknown),
    currentAttendance =
      !attendance.isError &&
      attendance.data?.session_version === native.version &&
      attendance.data.closure_state === native.attendance_state
        ? attendance.data
        : undefined;
  const date = center
    ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "full", timeZone: center.timezone }).format(
        new Date(native.starts_at),
      )
    : unknown;
  const time = center
    ? new Intl.DateTimeFormat("tr-TR", { timeStyle: "short", timeZone: center.timezone })
    : undefined;
  const title = !header.isError
    ? (header.data?.title ?? t(($) => $.sessionDetail.title))
    : t(($) => $.sessionDetail.title);
  const selectedRows = !reservations.isError ? (reservations.data?.items ?? []) : [];
  const blocked = locked || !center;
  const changePerson = (next?: { id: string; name: string }) => {
    if (blocked) return;
    setCursors([undefined]);
    setPage(0);
    setPerson(next);
  };
  const teacherRows = !instructors.isError
    ? (instructors.data?.instructors.map((row) => ({
        id: row.id,
        name: row.person?.display_name ?? unknown,
      })) ?? [])
    : [];
  return (
    <SessionWaitlistController
      scope={scope}
      session={native}
      timezone={center?.timezone}
      ownPersonId={
        workspace.isError ? undefined : workspace.data?.selected?.self_context?.person_id
      }
      disabled={booking || Boolean(cancel) || attendanceLocked || !center}
      onLockChange={setWaitlistLocked}
      onAccessLost={accessLost}
      onRefresh={refresh}
    >
      {(waitlistUi) => (
        <SessionAttendanceController
          scope={scope}
          session={native}
          attendance={currentAttendance}
          names={
            new Map(
              selectedRows.flatMap((row) =>
                row.person ? [[row.reservation.person_id, row.person.display_name] as const] : [],
              ),
            )
          }
          instructors={teacherRows}
          timezone={center?.timezone}
          disabled={booking || Boolean(cancel) || waitlistLocked || !center}
          onLockChange={setAttendanceLocked}
          onAccessLost={accessLost}
          onRefresh={refresh}
          onRetry={() => {
            void attendance.refetch();
          }}
        >
          {(attendanceUi) => (
            <SessionDetailView
              title={title}
              badges={[
                t(($) => $.schedule.sessionStates[native.state]),
                t(($) => $.schedule.formats[native.format]),
                t(($) =>
                  native.attendance_state === "open"
                    ? $.sessionDetail.open
                    : $.sessionDetail.closed,
                ),
              ]}
              scheduleHref={`/o/${scope.orgId}/c/${scope.centerId}/schedule`}
              capacity={native.capacity}
              facts={[
                { label: t(($) => $.sessionDetail.date), value: date },
                {
                  label: t(($) => $.sessionDetail.time),
                  value: time
                    ? `${time.format(new Date(native.starts_at))} – ${time.format(new Date(native.ends_at))}`
                    : unknown,
                },
                {
                  label: t(($) => $.sessionDetail.duration),
                  value: t(($) => $.sessionDetail.minutes, {
                    minutes: Math.round(
                      (Date.parse(native.ends_at) - Date.parse(native.starts_at)) / 60000,
                    ),
                  }),
                },
                {
                  label: t(($) => $.sessionDetail.room),
                  value: !rooms.isError
                    ? rooms.data?.map((row) => row.name).join(" · ") || unknown
                    : unknown,
                },
              ]}
              instructors={
                !instructors.isError
                  ? (instructors.data?.instructors.map((row) => ({
                      id: row.id,
                      name: row.person?.display_name ?? unknown,
                    })) ?? [])
                  : []
              }
              actions={{
                locked: blocked,
                start: attendanceUi.onStart,
                edit:
                  native.state === "planned"
                    ? () => {
                        void navigate({
                          to: "/o/$orgId/c/$centerId/schedule",
                          params: { orgId: scope.orgId, centerId: scope.centerId },
                          search: { session: sessionId, action: "edit" },
                        });
                      }
                    : undefined,
                cancel:
                  native.state === "planned"
                    ? () => {
                        void navigate({
                          to: "/o/$orgId/c/$centerId/schedule",
                          params: { orgId: scope.orgId, centerId: scope.centerId },
                          search: { session: sessionId, action: "cancel" },
                        });
                      }
                    : undefined,
                instructor:
                  native.state === "planned"
                    ? () => {
                        void navigate({
                          to: "/o/$orgId/c/$centerId/schedule",
                          params: { orgId: scope.orgId, centerId: scope.centerId },
                          search: { session: sessionId, action: "instructor" },
                        });
                      }
                    : undefined,
              }}
              participants={
                <SessionParticipants
                  rows={selectedRows.map((row) => {
                    const entry = currentAttendance?.entries.find(
                      (item) =>
                        item.reservation_id === row.reservation.id &&
                        item.person_id === row.reservation.person_id,
                    );
                    const name = row.person?.display_name ?? unknown;
                    return {
                      id: row.reservation.id,
                      name,
                      category: row.reservation.booking_category
                        ? t(($) => $.sessionDetail[row.reservation.booking_category!])
                        : t(($) => $.sessionDetail.noCategory),
                      rights: (() => {
                        const summary = row.reservation.source_summary;
                        if (!summary) return unknown;
                        if (summary.status !== "available")
                          return t(($) => $.sessionDetail.sourceStatuses[summary.status]);
                        return t(($) => $.sessionDetail.assignedSource, {
                          name: summary.product_name,
                          available:
                            summary.kind === "timed"
                              ? t(($) => $.sessionDetail.timedRight)
                              : t(($) => $.sessionDetail.credits, {
                                  available: summary.available_credits ?? unknown,
                                }),
                          state: t(($) => $.sessionDetail.sourceSaleStates[summary.sale_state]),
                          start: summary.start_date,
                          end: summary.end_date,
                        });
                      })(),
                      reservation: t(
                        ($) => $.memberProfile.reservationStates[row.reservation.state],
                      ),
                      attendance: !currentAttendance
                        ? unknown
                        : !entry
                          ? t(($) => $.memberProfile.attendanceNoEntry)
                          : native.attendance_state === "closed"
                            ? t(($) => $.memberProfile.attendanceResults[entry.result])
                            : t(($) => $.memberProfile.attendanceDraft, {
                                result: t(($) => $.memberProfile.attendanceResults[entry.result]),
                              }),
                      action:
                        row.reservation.state === "active" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            isDisabled={blocked || booking || Boolean(cancel)}
                            onPress={() =>
                              setCancel({
                                id: row.reservation.id,
                                personId: row.reservation.person_id,
                                name,
                              })
                            }
                          >
                            {t(($) => $.sessionDetail.cancelReservation, { name })}
                          </Button>
                        ) : undefined,
                    };
                  })}
                  search={search}
                  onSearch={setSearch}
                  onQuery={() => {
                    if (blocked) return;
                    setQuery(search.trim());
                    setPeopleCursors([undefined]);
                    setPeoplePage(0);
                    changePerson();
                    if (query === search.trim()) void people.refetch();
                  }}
                  onAdd={
                    native.state === "planned" && !blocked ? () => setBooking(true) : undefined
                  }
                  locked={blocked}
                  filteredPerson={person?.name}
                  onClear={() => changePerson()}
                  notice={
                    <>
                      {reservations.isError && (
                        <Alert variant="destructive">
                          <AlertDescription>
                            {t(($) => $.sessionDetail.readFailed)}
                          </AlertDescription>
                        </Alert>
                      )}
                      {query !== undefined && (
                        <div className="flex flex-col gap-3">
                          <Field>
                            <FieldLabel htmlFor="session-person-filter">
                              {t(($) => $.sessionDetail.peopleCandidates)}
                            </FieldLabel>
                            <NativeSelect
                              id="session-person-filter"
                              className="w-full"
                              value={person?.id ?? ""}
                              disabled={blocked || people.isFetching || people.isError}
                              onChange={(event) => {
                                const row = people.data?.items.find(
                                  (item) => item.id === event.target.value,
                                );
                                changePerson(
                                  row ? { id: row.id, name: row.display_name } : undefined,
                                );
                              }}
                            >
                              <NativeSelectOption value="">
                                {t(($) => $.sessionDetail.choosePerson)}
                              </NativeSelectOption>
                              {!people.isError &&
                                people.data?.items.map((row) => (
                                  <NativeSelectOption key={row.id} value={row.id}>
                                    {row.display_name}
                                  </NativeSelectOption>
                                ))}
                            </NativeSelect>
                          </Field>
                          <p className="text-xs text-muted-foreground">
                            {t(($) => $.sessionDetail.chooseSearchPerson)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              isDisabled={blocked || peoplePage === 0 || people.isFetching}
                              onPress={() => {
                                changePerson();
                                setPeoplePage((value) => value - 1);
                              }}
                            >
                              {t(($) => $.sessionDetail.previous)}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              isDisabled={
                                blocked ||
                                people.isFetching ||
                                people.isError ||
                                !people.data?.next_cursor
                              }
                              onPress={() => {
                                const cursor = people.data?.next_cursor;
                                if (cursor) {
                                  changePerson();
                                  setPeopleCursors((old) => [
                                    ...old.slice(0, peoplePage + 1),
                                    cursor,
                                  ]);
                                  setPeoplePage((value) => value + 1);
                                }
                              }}
                            >
                              {t(($) => $.sessionDetail.next)}
                            </Button>
                          </div>
                          {people.isError && (
                            <Alert variant="destructive">
                              <AlertDescription>
                                {t(($) => $.sessionDetail.readFailed)}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}
                    </>
                  }
                  pagination={
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={blocked || page === 0 || reservations.isFetching}
                        onPress={() => setPage((value) => value - 1)}
                      >
                        {t(($) => $.sessionDetail.previous)}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={
                          blocked ||
                          reservations.isFetching ||
                          reservations.isError ||
                          !reservations.data?.next_cursor
                        }
                        onPress={() => {
                          const cursor = reservations.data?.next_cursor;
                          if (cursor) {
                            setCursors((old) => [...old.slice(0, page + 1), cursor]);
                            setPage((value) => value + 1);
                          }
                        }}
                      >
                        {t(($) => $.sessionDetail.next)}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={blocked || reservations.isFetching}
                        onPress={() => {
                          void reservations.refetch();
                        }}
                      >
                        {t(($) => $.sessionDetail.retry)}
                      </Button>
                    </>
                  }
                />
              }
              attendance={attendanceUi.panel}
              waitlist={waitlistUi.panel}
              overlays={
                <>
                  {attendanceUi.overlays}
                  {waitlistUi.overlay}
                  {booking && (
                    <SessionBookingEditor
                      scope={scope}
                      session={native}
                      title={title}
                      onClose={() => setBooking(false)}
                      onLockChange={setBookingLocked}
                      onAccessLost={accessLost}
                      onRefresh={refresh}
                    />
                  )}
                  {cancel && (
                    <CancelReservation
                      scope={scope}
                      personId={cancel.personId}
                      reservationId={cancel.id}
                      sessionId={sessionId}
                      label={cancel.name}
                      sourceAvailable={Boolean(center && !reservations.isError)}
                      onClose={() => setCancel(undefined)}
                      onLockChange={setCancelLocked}
                      onAccessLost={accessLost}
                      onRefresh={refresh}
                    />
                  )}
                </>
              }
            />
          )}
        </SessionAttendanceController>
      )}
    </SessionWaitlistController>
  );
}
