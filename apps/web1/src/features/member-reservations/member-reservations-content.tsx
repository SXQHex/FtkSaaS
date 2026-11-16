import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { MemberCancellationPolicy } from "../member-classes/member-cancellation-policy";
import { CancelReservation } from "../member-profile/cancel-reservation";
import { memberReservationRows } from "../member-profile/reservations";
import { readOwnReservations, type OwnReservations } from "./member-reservations-read";
import { MemberReservationsView } from "./member-reservations-view";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
export function MemberReservationsContent({
  scope,
  personId,
  timezone,
  onLockChange,
}: {
  scope: ClientScope;
  personId: string;
  timezone: string;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation(),
    router = useRouter();
  const [upCursors, setUpCursors] = useState<(string | undefined)[]>([undefined]);
  const [pastCursors, setPastCursors] = useState<(string | undefined)[]>([undefined]);
  const retryButton = useRef<HTMLButtonElement>(null);
  const [locked, setLocked] = useState(false);
  const [target, setTarget] = useState<{
    reservationId: string;
    sessionId: string;
    label: string;
  }>();
  const prefix = ["member-reservations", scope.accountId, scope.orgId, scope.centerId, personId];
  const up = useQuery({
    queryKey: [...prefix, "upcoming", upCursors.at(-1)],
    queryFn: () => readOwnReservations(scope, personId, "upcoming", upCursors.at(-1)),
    retry: false,
  });
  const past = useQuery({
    queryKey: [...prefix, "past", pastCursors.at(-1)],
    queryFn: () => readOwnReservations(scope, personId, "past", pastCursors.at(-1)),
    retry: false,
  });
  const accessLost = useCallback(
    (error: unknown) => {
      const lost =
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message));
      if (lost) void router.invalidate();
      return lost;
    },
    [router],
  );
  const lock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  useEffect(() => {
    for (const error of [up.error, past.error]) if (error) accessLost(error);
  }, [up.error, past.error, accessLost]);
  const upcoming = !up.isError ? up.data : undefined,
    history = !past.isError ? past.data : undefined;
  const date = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: timezone });
  const time = new Intl.DateTimeFormat("tr-TR", { timeStyle: "short", timeZone: timezone });
  const historyRows = history ? memberReservationRows(history.items, timezone, [], t) : undefined;
  function pagination(kind: "upcoming" | "past") {
    const query = kind === "upcoming" ? up : past,
      cursors = kind === "upcoming" ? upCursors : pastCursors;
    const setCursors = kind === "upcoming" ? setUpCursors : setPastCursors,
      next = query.data?.nextCursor;
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          isDisabled={locked || query.isFetching || cursors.length === 1}
          onPress={() => setCursors((old) => old.slice(0, -1))}
        >
          {t(($) => $.memberReservations.previous)}
        </Button>
        <Button
          variant="outline"
          isDisabled={
            locked || query.isFetching || query.isError || !next || cursors.includes(next)
          }
          onPress={() => {
            if (next && !cursors.includes(next)) setCursors((old) => [...old, next]);
          }}
        >
          {t(($) => $.memberReservations.next)}
        </Button>
      </div>
    );
  }
  function label(row: OwnReservations["items"][number]) {
    return row.title ?? t(($) => $.memberReservations.unknown);
  }
  async function refresh() {
    const results = await Promise.all([up.refetch(), past.refetch()]);
    if (results.some((result) => result.isError))
      throw new Error("MEMBER_RESERVATIONS_REFRESH_UNAVAILABLE");
  }
  return (
    <>
      <MemberReservationsView
        upcoming={
          upcoming?.items.map((row) => ({
            id: row.reservation.id,
            time: row.session
              ? time.format(new Date(row.session.starts_at))
              : t(($) => $.memberReservations.unknown),
            duration: row.session
              ? t(($) => $.memberReservations.duration, {
                  minutes: new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(
                    (Date.parse(row.session.ends_at) - Date.parse(row.session.starts_at)) / 60000,
                  ),
                })
              : "—",
            title: label(row),
            metadata: [
              row.session
                ? date.format(new Date(row.session.starts_at))
                : t(($) => $.memberReservations.unknown),
              ...(row.lesson?.instructors ?? []),
              ...(row.lesson?.rooms ?? []),
            ].join(" · "),
            policy: row.lesson ? (
              <MemberCancellationPolicy value={row.lesson.cancellation} timezone={timezone} />
            ) : undefined,
            hint: [
              row.reservation.source_summary?.status === "available"
                ? row.reservation.source_summary.product_name
                : undefined,
              !row.lesson ? t(($) => $.memberReservations.policyUnknown) : undefined,
            ]
              .filter(Boolean)
              .join(" · "),
            state:
              row.session?.state === "cancelled"
                ? t(($) => $.instructorToday.states.cancelled)
                : t(($) => $.memberProfile.reservationStates[row.reservation.state]),
            action:
              row.reservation.state === "active" &&
              row.session?.state === "planned" &&
              Date.parse(row.session.starts_at) >= Date.parse(upcoming.asOf) ? (
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={locked || Boolean(target) || up.isFetching}
                  onPress={() =>
                    setTarget({
                      reservationId: row.reservation.id,
                      sessionId: row.reservation.session_id,
                      label: `${label(row)} · ${date.format(new Date(row.session!.starts_at))} ${time.format(new Date(row.session!.starts_at))}`,
                    })
                  }
                >
                  {t(($) => $.memberReservations.cancel)} — {label(row)}
                </Button>
              ) : undefined,
          })) ?? null
        }
        waiting={null}
        history={
          historyRows?.map((row, index) => ({
            id: row.id,
            date: row.date,
            title: history!.items[index]!.title ?? row.lesson,
            state: `${row.reservation} · ${row.attendance}`,
          })) ?? null
        }
        upcomingPagination={pagination("upcoming")}
        historyPagination={pagination("past")}
        notice={
          <div className="space-y-3">
            <Alert>
              <AlertDescription>{t(($) => $.memberReservations.sourceLimits)}</AlertDescription>
            </Alert>
            <p className="text-xs text-muted-foreground">
              {t(($) => $.memberReservations.historyHint)}
            </p>
            {(up.isPending || past.isPending) && (
              <p role="status">{t(($) => $.memberReservations.loading)}</p>
            )}
            <Button
              ref={retryButton}
              variant="outline"
              isDisabled={locked || up.isFetching || past.isFetching}
              onPress={() => {
                if (up.isError) void up.refetch();
                if (past.isError) void past.refetch();
                if (!up.isError && !past.isError) {
                  void up.refetch();
                  void past.refetch();
                }
              }}
            >
              {t(($) => $.memberReservations.retry)}
            </Button>
          </div>
        }
      />
      {target && (
        <CancelReservation
          scope={scope}
          personId={personId}
          reservationId={target.reservationId}
          sessionId={target.sessionId}
          label={target.label}
          sourceAvailable={Boolean(
            !up.isError &&
            upcoming?.items.some(
              (row) =>
                row.reservation.id === target.reservationId && row.reservation.state === "active",
            ),
          )}
          onClose={(saved) => {
            setTarget(undefined);
            if (saved) requestAnimationFrame(() => retryButton.current?.focus());
          }}
          onRefresh={refresh}
          onLockChange={lock}
          onAccessLost={accessLost}
        />
      )}
    </>
  );
}
