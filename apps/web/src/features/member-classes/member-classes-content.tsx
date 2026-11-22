import { invalidateMemberReservationViews } from "../member-reservations/member-reservations-query";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { memberClassWeek, readMemberClasses, type MemberClass } from "./member-classes-read";
import { MemberClassesView } from "./member-classes-view";
import { MemberClassEditor } from "./member-class-editor";
import type { ClassAction } from "./member-class-command";
import { CancelReservation } from "../member-profile/cancel-reservation";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
export function MemberClassesContent({
  scope,
  personId,
  timezone,
  weekStart,
  onLockChange,
}: {
  scope: ClientScope;
  personId: string;
  timezone: string;
  weekStart: "monday" | "sunday" | null;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    router = useRouter();
  const [now] = useState(() => new Date().toISOString()),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState(""),
    [locked, setLocked] = useState(false),
    [target, setTarget] = useState<{ row: MemberClass; action: ClassAction | "cancel" }>();
  const prefix = ["member-classes", scope.accountId, scope.orgId, scope.centerId, personId];
  const period = useQuery({
    queryKey: [...prefix, "week", timezone, now, offset, weekStart],
    queryFn: () => memberClassWeek(timezone, now, offset, weekStart!),
    enabled: weekStart !== null,
    retry: false,
  });
  const lessons = useQuery({
    queryKey: [...prefix, "lessons", period.data?.interval],
    queryFn: () => readMemberClasses(scope, period.data!.interval),
    enabled: !!period.data,
    retry: false,
  });
  const lock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  const accessLost = useCallback(
    (cause: unknown) => {
      const lost =
        (cause instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.code)) ||
        (cause instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(cause.message));
      if (lost) void router.invalidate();
      return lost;
    },
    [router],
  );
  useEffect(() => {
    for (const cause of [period.error, lessons.error]) if (cause) accessLost(cause);
  }, [period.error, lessons.error, accessLost]);
  const frame = period.data;
  const day =
    frame?.days.find((value) => value.id === selected)?.id ??
    frame?.days.find((value) => value.today)?.id ??
    frame?.start ??
    "";
  const date = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  });
  const key = (instant: string) => {
    const parts = date.formatToParts(new Date(instant));
    return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
  };
  const time = new Intl.DateTimeFormat("tr-TR", { timeStyle: "short", timeZone: timezone });
  const rows = !lessons.isError ? lessons.data : undefined;
  async function refresh() {
    await invalidateMemberReservationViews(queries, scope, personId);
    await invalidateCachedFamilies(queries, [prefix]);
    await lessons.refetch({ throwOnError: true });
  }
  function choose(row: MemberClass, action: ClassAction | "cancel") {
    if (!locked) setTarget({ row: structuredClone(row), action });
  }
  return (
    <>
      <MemberClassesView
        locked={locked}
        loading={period.isPending || (!period.isError && lessons.isPending)}
        range={frame?.range ?? t(($) => $.memberClasses.unknown)}
        days={(frame?.days ?? []).map((value) => ({
          ...value,
          hasClasses: !!rows?.some((row) => key(row.starts_at) === value.id),
        }))}
        selectedDay={day}
        onDay={(value) => {
          if (!locked) setSelected(value);
        }}
        onWeek={(direction) => {
          if (!locked) {
            setSelected("");
            setOffset((value) => (direction === 0 ? 0 : value + direction));
          }
        }}
        rows={
          rows
            ? rows
                .filter((row) => key(row.starts_at) === day)
                .map((row) => {
                  const d = row.member_lesson,
                    own = d.own_reservation?.state === "active",
                    waiting =
                      d.own_waitlist && ["waiting", "offered"].includes(d.own_waitlist.state),
                    offer = d.own_waitlist?.offer?.state === "active",
                    full = row.capacity.remaining === 0,
                    open = d.booking_window.state === "open";
                  const action: ClassAction | "cancel" | undefined = own
                    ? "cancel"
                    : offer
                      ? "accept"
                      : waiting
                        ? "leave"
                        : open
                          ? full
                            ? d.waitlist_enabled
                              ? "join"
                              : undefined
                            : "book"
                          : undefined;
                  return {
                    id: row.id,
                    time: time.format(new Date(row.starts_at)),
                    duration: t(($) => $.memberClasses.duration, {
                      count: Math.round(
                        (Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 60000,
                      ),
                    }),
                    title: row.title,
                    priorityBooking: own && d.own_reservation?.mode === "priority",
                    metadata: [
                      d.instructor_labels.join(" · ") ||
                        t(($) => $.memberClasses.unassignedInstructor),
                      d.room_labels.join(" · ") || t(($) => $.memberClasses.unassignedRoom),
                      d.format === "private"
                        ? t(($) => $.memberClasses.private)
                        : t(($) => $.memberClasses.group),
                    ].join(" · "),
                    state: own
                      ? t(($) => $.memberClasses.booked)
                      : offer
                        ? t(($) => $.memberClasses.offer)
                        : waiting
                          ? t(($) => $.memberClasses.waiting)
                          : !open
                            ? t(($) => $.memberClasses.window[d.booking_window.state])
                            : full
                              ? t(($) => $.memberClasses.full)
                              : t(($) => $.memberClasses.available, {
                                  count: row.capacity.remaining,
                                }),
                    hint:
                      full && !d.waitlist_enabled
                        ? t(($) => $.memberClasses.waitlistOff)
                        : undefined,
                    action: action
                      ? {
                          label:
                            action === "cancel"
                              ? t(($) => $.memberClasses.cancelBooking)
                              : action === "accept"
                                ? t(($) => $.memberClasses.offer)
                                : t(($) => $.memberClasses[action]),
                          disabled: locked,
                          onPress: () => choose(row, action),
                        }
                      : undefined,
                  };
                })
            : null
        }
        policy={t(($) => $.memberClasses.policyHint)}
        notice={
          <>
            {(period.isError || lessons.isError) && (
              <Alert variant="destructive">
                <AlertDescription>{t(($) => $.memberClasses.sourceError)}</AlertDescription>
              </Alert>
            )}
            <Button
              variant="outline"
              isDisabled={locked || period.isFetching || lessons.isFetching}
              onPress={() => {
                if (period.isError) void period.refetch();
                else void lessons.refetch();
              }}
            >
              {t(($) => $.memberClasses.refresh)}
            </Button>
          </>
        }
      />
      {target && target.action !== "cancel" && (
        <MemberClassEditor
          key={`${target.row.id}:${target.action}`}
          scope={scope}
          personId={personId}
          before={target.row}
          action={target.action}
          timezone={timezone}
          onSaved={refresh}
          onClose={() => {
            if (!locked) {
              setTarget(undefined);
              void refresh();
            }
          }}
          onLockChange={lock}
          onAccessLost={accessLost}
        />
      )}
      {target?.action === "cancel" && target.row.member_lesson.own_reservation && (
        <CancelReservation
          scope={scope}
          personId={personId}
          reservationId={target.row.member_lesson.own_reservation.id}
          sessionId={target.row.id}
          label={target.row.title}
          sourceAvailable
          onClose={() => {
            setTarget(undefined);
            void refresh();
          }}
          onRefresh={refresh}
          onLockChange={lock}
          onAccessLost={accessLost}
        />
      )}
    </>
  );
}
