import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SessionBookingSheet, type SessionBookingDraft } from "./session-detail-panels";
import type { ClientScope } from "../../lib/scoped-backend";
import type { SessionView } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { readPeoplePage } from "../people/people";
import { useMemberCommand } from "../member-profile/use-member-command";
import { readScheduleSession } from "../schedule/schedule-read";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { readSessionParticipants } from "./session-detail-read";
import {
  readBookingRights,
  readCapacityOverride,
  sessionBookingIntent,
  writeSessionBooking,
  readSessionBookingReceipt,
  readSessionBookingResult,
} from "./session-booking";

export function SessionBookingEditor({
  scope,
  session,
  title,
  onClose,
  onLockChange,
  onAccessLost,
  onRefresh,
}: {
  scope: ClientScope;
  session: SessionView;
  title: string;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<SessionBookingDraft>({
    query: "",
    personId: "",
    saleId: "",
    mode: "flexible",
    category: "",
    override: false,
    reason: "",
    reviewed: false,
  });
  const [query, setQuery] = useState<string>(),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const [reviewVersion, setReviewVersion] = useState(session.version);
  const prefix = [
    "session-detail",
    scope.accountId,
    scope.orgId,
    scope.centerId,
    session.id,
    "booking",
  ];
  const people = useQuery({
    queryKey: [...prefix, "people", query, cursors[page]],
    queryFn: () => readPeoplePage(scope, query!, cursors[page], "active"),
    enabled: query !== undefined,
    retry: false,
  });
  const rights = useQuery({
    queryKey: [...prefix, "rights", draft.personId, draft.mode],
    queryFn: () => readBookingRights(scope, draft.personId, session.id, draft.mode),
    enabled: Boolean(draft.personId),
    retry: false,
  });
  const override = useQuery({
    queryKey: [...prefix, "override", draft.personId, draft.saleId],
    queryFn: () => readCapacityOverride(scope, draft.personId, session.id, draft.saleId),
    enabled: Boolean(draft.personId && draft.saleId),
    retry: false,
  });
  const command = useMemberCommand({
    write: async (intent: ReturnType<typeof sessionBookingIntent>) => {
      try {
        return await writeSessionBooking(intent);
      } catch (failure) {
        setError(
          scheduleBackendError(
            failure instanceof BackendError ? failure.code : "SOURCE_UNAVAILABLE",
            t,
          ),
        );
        throw failure;
      }
    },
    readReceipt: readSessionBookingReceipt,
    readResult: readSessionBookingResult,
    onAccessLost,
    onRefresh: async () => {
      await onRefresh();
      await rights.refetch({ throwOnError: true });
    },
  });
  const locked = busy || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    for (const failure of [people.error, rights.error, override.error])
      if (failure) onAccessLost(failure);
  }, [people.error, rights.error, override.error, onAccessLost]);
  const person = people.isError
    ? undefined
    : people.data?.items.find((row) => row.id === draft.personId);
  const sales = rights.isError
    ? []
    : (rights.data?.filter((row) => row.state === "active" && row.booking_mode === draft.mode) ??
      []);
  const canOverride = !override.isError && override.data === session.version;
  function update(next: SessionBookingDraft) {
    if (locked) return;
    command.reset();
    setError(undefined);
    setReviewVersion(session.version);
    setDraft(
      next.mode !== draft.mode
        ? { ...next, saleId: "", override: false, reason: "", reviewed: false }
        : next,
    );
  }
  async function submit() {
    if (
      locked ||
      !draft.reviewed ||
      reviewVersion !== session.version ||
      !person ||
      rights.isFetching ||
      override.isFetching
    )
      return;
    setBusy(true);
    setError(undefined);
    try {
      const [fresh, freshRights, reservations] = await Promise.all([
        readScheduleSession(scope, session.id),
        readBookingRights(scope, draft.personId, session.id, draft.mode),
        readSessionParticipants(scope, session.id, draft.personId),
      ]);
      const sale = freshRights.find((row) => row.sale_id === draft.saleId);
      if (
        fresh.version !== reviewVersion ||
        fresh.state !== "planned" ||
        fresh.starts_at !== session.starts_at ||
        fresh.ends_at !== session.ends_at ||
        !sale
      ) {
        setDraft((value) => ({ ...value, reviewed: false, override: false }));
        await onRefresh();
        await rights.refetch({ throwOnError: true });
        setError(t(($) => $.sessionDetail.sourceChanged));
        return;
      }
      if (reservations.items.some((row) => row.reservation.state === "active")) {
        setError(t(($) => $.schedule.errors.reservation));
        return;
      }
      if (
        draft.override &&
        (!canOverride ||
          (await readCapacityOverride(scope, draft.personId, session.id, draft.saleId)) !==
            fresh.version)
      )
        throw new Error("SESSION_BOOKING_OVERRIDE_UNAVAILABLE");
      command.reset();
      await command.start(sessionBookingIntent(scope, session.id, draft, sale, canOverride));
    } catch (failure) {
      if (!onAccessLost(failure))
        setError(
          scheduleBackendError(
            failure instanceof BackendError ? failure.code : "SOURCE_UNAVAILABLE",
            t,
          ),
        );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    if (locked) return;
    command.reset();
    setError(undefined);
    setDraft((value) => ({ ...value, reviewed: false, override: false }));
    await onRefresh();
    if (draft.personId) await rights.refetch();
    if (query !== undefined) await people.refetch();
  }
  const stateText = t(($) => $.sessionDetail.bookingStates[command.state]);
  return (
    <SessionBookingSheet
      open
      waitlist={false}
      title={title}
      draft={{ ...draft, reviewed: draft.reviewed && reviewVersion === session.version }}
      onDraft={update}
      people={
        people.isError
          ? []
          : (people.data?.items.map((row) => ({ id: row.id, label: row.display_name })) ?? [])
      }
      sales={sales.map((row) => ({
        id: row.sale_id,
        label: t(($) => $.sessionDetail.bookingSale, {
          start: row.start_date,
          end: row.end_date,
          id: row.sale_id.slice(-8),
          available:
            row.kind === "timed"
              ? t(($) => $.sessionDetail.timedRight)
              : t(($) => $.sessionDetail.credits, {
                  available: row.available_at_session ?? t(($) => $.sessionDetail.unknown),
                }),
        }),
      }))}
      canOverride={canOverride}
      locked={locked}
      onClose={() => {
        if (!locked) onClose();
      }}
      onSubmit={
        !rights.isError && command.state !== "saved" && !command.unavailable
          ? () => {
              void submit();
            }
          : undefined
      }
      onSearch={() => {
        if (locked) return;
        command.reset();
        setQuery(draft.query.trim());
        setCursors([undefined]);
        setPage(0);
        setDraft((value) => ({
          ...value,
          personId: "",
          saleId: "",
          override: false,
          reason: "",
          reviewed: false,
        }));
      }}
      peoplePagination={
        query !== undefined && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              isDisabled={locked || people.isFetching || page === 0}
              onPress={() => {
                setPage((value) => value - 1);
                setDraft((value) => ({
                  ...value,
                  personId: "",
                  saleId: "",
                  reviewed: false,
                  override: false,
                }));
              }}
            >
              {t(($) => $.sessionDetail.previous)}
            </Button>
            <Button
              size="sm"
              variant="outline"
              isDisabled={
                locked || people.isFetching || people.isError || !people.data?.next_cursor
              }
              onPress={() => {
                const cursor = people.data?.next_cursor;
                if (cursor) {
                  setCursors((old) => [...old.slice(0, page + 1), cursor]);
                  setPage((value) => value + 1);
                  setDraft((value) => ({
                    ...value,
                    personId: "",
                    saleId: "",
                    reviewed: false,
                    override: false,
                  }));
                }
              }}
            >
              {t(($) => $.sessionDetail.next)}
            </Button>
          </div>
        )
      }
      notice={
        <>
          {(error || people.isError || rights.isError) && (
            <Alert variant="destructive">
              <AlertDescription>{error ?? t(($) => $.sessionDetail.sourceError)}</AlertDescription>
            </Alert>
          )}
          {stateText && <p role="status">{stateText}</p>}
        </>
      }
      recovery={
        <div className="flex flex-wrap gap-2">
          {["unknown", "pending", "saved-unread"].includes(command.state) && (
            <Button
              variant="outline"
              isDisabled={command.busy}
              onPress={() => {
                void command.readReceipt();
              }}
            >
              {t(($) => $.sessionDetail.readReceipt)}
            </Button>
          )}
          {command.state === "unknown" && (
            <Button
              variant="outline"
              isDisabled={command.busy}
              onPress={() => {
                void command.retry();
              }}
            >
              {t(($) => $.sessionDetail.retryWrite)}
            </Button>
          )}
          {["stale", "rejected"].includes(command.state) && (
            <Button
              variant="outline"
              isDisabled={locked}
              onPress={() => {
                void refresh();
              }}
            >
              {t(($) => $.sessionDetail.readSources)}
            </Button>
          )}
        </div>
      }
    />
  );
}
