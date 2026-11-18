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
import { readOwnWaitlist, type OwnWaitlistRow } from "./member-waitlist";
import { MemberWaitlistEditor } from "./member-waitlist-editor";
import type { WaitlistAction } from "../session-detail/session-waitlist";
import { MemberReservationsView } from "./member-reservations-view";
import { Button, LinkButton } from "../../components/ui/button";
export function MemberReservationsContent({
  scope,
  personId,
  sessionId,
  offerId,
  timezone,
  onLockChange,
}: {
  scope: ClientScope;
  personId: string;
  sessionId?: string;
  offerId?: string;
  timezone: string;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation(),
    router = useRouter();
  const [upCursors, setUpCursors] = useState<(string | undefined)[]>([undefined]);
  const [pastCursors, setPastCursors] = useState<(string | undefined)[]>([undefined]);
  const [entryCursors, setEntryCursors] = useState<(string | undefined)[]>([undefined]),
    [offerCursors, setOfferCursors] = useState<(string | undefined)[]>([undefined]);
  const [waitTarget, setWaitTarget] = useState<{
    row: OwnWaitlistRow;
    action: Exclude<WaitlistAction, "join">;
  }>();
  const retryButton = useRef<HTMLButtonElement>(null);
  const [locked, setLocked] = useState(false);
  const [target, setTarget] = useState<{
    reservationId: string;
    sessionId: string;
    label: string;
  }>();
  const prefix = ["member-reservations", scope.accountId, scope.orgId, scope.centerId, personId];
  const up = useQuery({
    queryKey: [...prefix, "upcoming", upCursors.at(-1), sessionId],
    queryFn: () => readOwnReservations(scope, personId, "upcoming", upCursors.at(-1), sessionId),
    ...(sessionId ? { staleTime: 0 } : {}),
    retry: false,
  });
  const past = useQuery({
    queryKey: [...prefix, "past", pastCursors.at(-1), sessionId],
    queryFn: () => readOwnReservations(scope, personId, "past", pastCursors.at(-1), sessionId),
    ...(sessionId ? { staleTime: 0 } : {}),
    retry: false,
  });
  const waiting = useQuery({
    queryKey: [...prefix, "waitlist", entryCursors.at(-1)],
    queryFn: () => readOwnWaitlist(scope, "entries", entryCursors.at(-1)),
    retry: false,
  });
  const offers = useQuery({
    queryKey: [...prefix, "offers", offerCursors.at(-1), offerId],
    queryFn: () =>
      offerId
        ? readOwnWaitlist(scope, "offers", undefined, { id: offerId, personId })
        : readOwnWaitlist(scope, "offers", offerCursors.at(-1)),
    ...(offerId ? { staleTime: 0 } : {}),
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
    for (const error of [up.error, past.error, waiting.error, offers.error])
      if (error) accessLost(error);
  }, [up.error, past.error, waiting.error, offers.error, accessLost]);
  const loadingUpcoming = up.isPending || Boolean(sessionId && up.isFetching);
  const loadingHistory = past.isPending || Boolean(sessionId && past.isFetching);
  const upcoming = !up.isError && !loadingUpcoming ? up.data : undefined,
    history = !past.isError && !loadingHistory ? past.data : undefined;
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
  async function refresh(purpose: "reservation" | "waitlist") {
    const [upcomingResult, pastResult, waitingResult, offersResult] = await Promise.all([
      up.refetch(),
      past.refetch(),
      waiting.refetch(),
      offers.refetch(),
    ]);
    const waitlistReadFailed = [waitingResult, offersResult].some(
      ({ isError, error }) =>
        isError &&
        !(
          purpose === "reservation" &&
          error instanceof BackendError &&
          error.code === "PLAN_FEATURE_UNAVAILABLE"
        ),
    );
    if (upcomingResult.isError || pastResult.isError || waitlistReadFailed)
      throw new Error("MEMBER_RESERVATIONS_REFRESH_UNAVAILABLE");
  }
  const loadingOffers = offers.isPending || Boolean(offerId && offers.isFetching);
  const offerPage = offers.isError || loadingOffers ? undefined : offers.data;
  return (
    <>
      <MemberReservationsView
        pending={{
          upcoming: loadingUpcoming,
          waiting:
            !offers.isError &&
            (loadingOffers || (!offerId && !waiting.isError && waiting.isPending)),
          history: loadingHistory,
        }}
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
                  isDisabled={locked || Boolean(target) || Boolean(waitTarget) || up.isFetching}
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
        waiting={
          !offerPage || (!offerId && (waiting.isError || !waiting.data))
            ? null
            : [...offerPage.items, ...(offerId ? [] : (waiting.data?.items ?? []))].map((row) => {
                const dateTime = new Intl.DateTimeFormat("tr-TR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: row.session.timezone,
                });
                const eligible =
                  row.session.state === "planned" &&
                  !locked &&
                  !target &&
                  !waitTarget &&
                  !waiting.isFetching &&
                  !offers.isFetching;
                return {
                  id: `${row.offer ? "offer" : "entry"}:${row.id}`,
                  title: row.session.title,
                  time: new Intl.DateTimeFormat("tr-TR", {
                    timeStyle: "short",
                    timeZone: row.session.timezone,
                  }).format(new Date(row.session.interval.starts_at)),
                  duration: t(($) => $.memberReservations.duration, {
                    minutes:
                      (Date.parse(row.session.interval.ends_at) -
                        Date.parse(row.session.interval.starts_at)) /
                      60000,
                  }),
                  metadata: dateTime.format(new Date(row.session.interval.starts_at)),
                  hint: row.offer
                    ? t(($) => $.memberClasses.offerExpires, {
                        time: dateTime.format(new Date(row.offer.expires_at)),
                      })
                    : t(($) => $.memberReservations.queuePositionUnknown),
                  state: row.offer
                    ? t(($) =>
                        row.offer?.state === "active"
                          ? $.memberReservations.activeOffer
                          : $.sessionDetail[row.offer!.state],
                      )
                    : t(($) => $.memberClasses.waiting),
                  action:
                    row.offer && row.offer.state !== "active" ? undefined : (
                      <div className="flex flex-wrap gap-2">
                        {(row.offer ? (["accept", "reject"] as const) : (["leave"] as const)).map(
                          (action) => (
                            <Button
                              key={action}
                              size="sm"
                              variant="outline"
                              isDisabled={
                                !eligible ||
                                Boolean(
                                  row.offer &&
                                  Date.parse(row.offer.expires_at) <= Date.parse(offerPage.asOf),
                                )
                              }
                              onPress={() => setWaitTarget({ row, action })}
                            >
                              {t(($) => $.memberClasses[action])}
                            </Button>
                          ),
                        )}
                      </div>
                    ),
                };
              })
        }
        waitingPagination={
          offerId ? undefined : (
            <div className="flex flex-wrap gap-4">
              {(["entries", "offers"] as const).map((view) => {
                const query = view === "entries" ? waiting : offers,
                  cursors = view === "entries" ? entryCursors : offerCursors,
                  setCursors = view === "entries" ? setEntryCursors : setOfferCursors,
                  next = query.data?.nextCursor;
                return (
                  <div
                    key={view}
                    role="group"
                    aria-label={t(($) => $.memberReservations.queuePages[view])}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="text-xs">
                      {t(($) => $.memberReservations.queuePages[view])}
                    </span>
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
                        locked ||
                        query.isFetching ||
                        query.isError ||
                        !next ||
                        cursors.includes(next)
                      }
                      onPress={() => {
                        if (next && !cursors.includes(next)) setCursors((old) => [...old, next]);
                      }}
                    >
                      {t(($) => $.memberReservations.next)}
                    </Button>
                  </div>
                );
              })}
            </div>
          )
        }
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
            {(sessionId || offerId) && (
              <LinkButton
                variant="outline"
                href={`/member/reservations?${new URLSearchParams({ org: scope.orgId, center: scope.centerId })}`}
                isDisabled={locked}
              >
                {t(($) => $.memberReservations.allReservations)}
              </LinkButton>
            )}
            <p className="text-xs text-muted-foreground">
              {t(($) => $.memberReservations.historyHint)}
            </p>
            <Button
              ref={retryButton}
              variant="outline"
              isDisabled={
                locked ||
                up.isFetching ||
                past.isFetching ||
                waiting.isFetching ||
                offers.isFetching
              }
              onPress={() => {
                void waiting.refetch();
                void offers.refetch();
                void up.refetch();
                void past.refetch();
              }}
            >
              {t(($) => $.memberReservations.retry)}
            </Button>
          </div>
        }
      />
      {waitTarget && (
        <MemberWaitlistEditor
          key={`${waitTarget.row.id}:${waitTarget.action}`}
          scope={scope}
          personId={personId}
          before={waitTarget.row}
          action={waitTarget.action}
          onClose={() => {
            setWaitTarget(undefined);
            requestAnimationFrame(() => retryButton.current?.focus());
          }}
          onSaved={() => refresh("waitlist")}
          onLockChange={lock}
          onAccessLost={accessLost}
        />
      )}
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
          onRefresh={() => refresh("reservation")}
          onLockChange={lock}
          onAccessLost={accessLost}
        />
      )}
    </>
  );
}
