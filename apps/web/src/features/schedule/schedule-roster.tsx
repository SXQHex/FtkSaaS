import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { GroupStudentReservation, Interval, SessionView } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
import { invalidateAndReadFirstPage } from "../../lib/cache-invalidation";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@ftksaas/ui/components/field";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@ftksaas/ui/components/item";
import { readPeoplePage } from "../people/people";
import { readProfileRights } from "../member-profile/profile-read";
import { CancelReservation } from "../member-profile/cancel-reservation";
import { useMemberCommand } from "../member-profile/use-member-command";
import { readScheduleRange, readScheduleSession } from "./schedule-read";
import { scheduleBackendError } from "./schedule-presentation";
import {
  readGroupStudents,
  priorityIntent,
  writePriority,
  readPriorityReceipt,
  readPriorityResult,
  type PriorityIntent,
} from "./group-students";

export function ScheduleRoster({
  scope,
  classId,
  interval,
  timezone,
  editing,
  onLockChange,
  onAccessLost,
  onRefresh,
}: {
  scope: ClientScope;
  classId: string;
  interval: Interval;
  timezone: string;
  editing: boolean;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [page, setPage] = useState(0);
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState<string>();
  const [peopleCursors, setPeopleCursors] = useState<(string | undefined)[]>([undefined]),
    [peoplePage, setPeoplePage] = useState(0);
  const [personId, setPersonId] = useState(""),
    [saleId, setSaleId] = useState(""),
    [sessionId, setSessionId] = useState("");
  const [prepared, setPrepared] = useState<{
    intent: PriorityIntent;
    session: SessionView;
    person: string;
    sale: string;
  }>();
  const [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const [cancel, setCancel] = useState<{
    personId: string;
    name: string;
    reservation: GroupStudentReservation;
  }>();
  const [cancelLocked, setCancelLocked] = useState(false);
  const groupFamily = ["schedule-group", scope.accountId, scope.orgId, scope.centerId, classId];
  const groupPeriod = [...groupFamily, interval.starts_at, interval.ends_at];
  const group = useQuery({
    queryKey: [...groupPeriod, cursors[page]],
    queryFn: (readContext) =>
      readGroupStudents(scope, classId, interval, "", cursors[page], readContext),
    retry: false,
  });
  async function refreshRoster() {
    await invalidateAndReadFirstPage({
      queries,
      families: [groupFamily],
      firstPageKey: [...groupPeriod, undefined],
      readFirstPage: () => readGroupStudents(scope, classId, interval, ""),
    });
    setCursors([undefined]);
    setPage(0);
  }
  const people = useQuery({
    queryKey: [
      "schedule-group-people",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      query,
      peopleCursors[peoplePage],
    ],
    queryFn: (readContext) =>
      readPeoplePage(
        scope,
        query ?? "",
        peopleCursors[peoplePage],
        "active",
        undefined,
        undefined,
        readContext,
      ),
    enabled: editing && query !== undefined,
    retry: false,
  });
  const rights = useQuery({
    queryKey: ["schedule-group-rights", scope.accountId, scope.orgId, scope.centerId, personId],
    queryFn: (readContext) => readProfileRights(scope, personId, undefined, readContext),
    enabled: editing && Boolean(personId),
    retry: false,
  });
  const sessions = useQuery({
    queryKey: [
      "schedule-group-sessions",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      interval.starts_at,
      interval.ends_at,
    ],
    queryFn: (readContext) => readScheduleRange(scope, interval, undefined, undefined, readContext),
    enabled: editing,
    retry: false,
  });
  const command = useMemberCommand({
    write: async (intent: Parameters<typeof writePriority>[0]) => {
      try {
        return await writePriority(intent);
      } catch (failure) {
        if (failure instanceof BackendError && failure.code === "DEBT_BOOKING_BLOCKED")
          setError(scheduleBackendError(failure.code, t));
        throw failure;
      }
    },
    readReceipt: readPriorityReceipt,
    readResult: readPriorityResult,
    onAccessLost,
    onRefresh: async () => {
      await Promise.all([refreshRoster(), rights.refetch({ throwOnError: true }), onRefresh()]);
    },
  });
  const locked = busy || command.locked || cancelLocked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    for (const failure of [group.error, people.error, rights.error, sessions.error])
      if (failure) onAccessLost(failure);
  }, [group.error, people.error, rights.error, sessions.error, onAccessLost]);
  const format = (start: string, end: string) => {
    const date = new Intl.DateTimeFormat("tr-TR", {
      timeZone: timezone,
      dateStyle: "short",
      timeStyle: "short",
    });
    return `${date.format(new Date(start))} – ${date.format(new Date(end))}`;
  };
  const sales = !rights.isError
    ? (rights.data?.filter((row) => row.state === "active" && row.booking_mode === "priority") ??
      [])
    : [];
  const targets = !sessions.isError
    ? (sessions.data?.entries.flatMap((row) =>
        row.type === "session" &&
        row.session.class_id === classId &&
        row.session.state === "planned"
          ? [row.session]
          : [],
      ) ?? [])
    : [];
  const selectedPerson = !people.isError
    ? people.data?.items.find((row) => row.id === personId)
    : undefined;
  function reset() {
    if (locked) return;
    command.reset();
    setPrepared(undefined);
    setAccepted(false);
    setError(undefined);
  }
  async function prepare() {
    if (locked) return;
    setBusy(true);
    setCursors([undefined]);
    setPage(0);
    setError(undefined);
    try {
      const sale = sales.find((row) => row.sale_id === saleId);
      const target = targets.find((row) => row.id === sessionId);
      if (!selectedPerson || !sale || !target) throw new Error("SCHEDULE_GROUP_SOURCE_UNAVAILABLE");
      const fresh = await readScheduleSession(scope, sessionId);
      if (
        fresh.class_id !== classId ||
        fresh.state !== "planned" ||
        fresh.version !== target.version ||
        fresh.starts_at !== target.starts_at ||
        fresh.ends_at !== target.ends_at
      )
        throw new Error("SCHEDULE_GROUP_SOURCE_UNAVAILABLE");
      setPrepared({
        intent: priorityIntent(scope, personId, sessionId, sale),
        session: fresh,
        person: selectedPerson.display_name,
        sale: `${sale.start_date} – ${sale.end_date} · ${sale.sale_id.slice(-8)}`,
      });
      setAccepted(false);
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
  const statusText = t(($) => $.scheduleRoster.states[command.state]);
  return (
    <>
      <div className="flex min-w-0 flex-col gap-4" inert={Boolean(cancel)}>
        <Alert>
          <AlertDescription>
            {t(($) => $.scheduleRoster.scope, {
              interval: format(interval.starts_at, interval.ends_at),
              timezone,
            })}
          </AlertDescription>
        </Alert>
        {group.isPending && <p>{t(($) => $.products.historyLoading)}</p>}
        {(group.isError || people.isError || rights.isError || sessions.isError) && (
          <Alert variant="destructive">
            <AlertDescription>
              {t(($) => $.scheduleRoster.readError)}
              <Button
                variant="outline"
                isDisabled={locked}
                onPress={() => {
                  void group.refetch();
                  if (query !== undefined) void people.refetch();
                  if (personId) void rights.refetch();
                  if (editing) void sessions.refetch();
                }}
              >
                {t(($) => $.people.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!group.isError && group.data?.items.length === 0 && (
          <p>{t(($) => $.schedule.emptyRoster)}</p>
        )}
        {!group.isError && Boolean(group.data?.items.length) && (
          <ItemGroup>
            {group.data?.items.map((student) => (
              <Item key={student.person_id} role="listitem" variant="outline">
                <ItemContent>
                  <ItemTitle>{student.display_name}</ItemTitle>
                  {student.reservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <ItemDescription>
                        {format(reservation.starts_at, reservation.ends_at)}
                      </ItemDescription>
                      {editing && (
                        <ItemActions>
                          <Button
                            size="sm"
                            variant="outline"
                            isDisabled={locked}
                            onPress={() => {
                              setCursors([undefined]);
                              setPage(0);
                              setCancel({
                                personId: student.person_id,
                                name: student.display_name,
                                reservation,
                              });
                            }}
                            aria-label={t(($) => $.scheduleRoster.removeLabel, {
                              name: student.display_name,
                              date: format(reservation.starts_at, reservation.ends_at),
                            })}
                          >
                            {t(($) => $.scheduleRoster.remove)}
                          </Button>
                        </ItemActions>
                      )}
                    </div>
                  ))}
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            isDisabled={locked || Boolean(prepared) || page === 0 || group.isFetching}
            onPress={() => setPage((value) => value - 1)}
          >
            {t(($) => $.people.previous)}
          </Button>
          <Button
            size="sm"
            variant="outline"
            isDisabled={
              locked ||
              Boolean(prepared) ||
              group.isError ||
              group.isFetching ||
              !group.data?.next_cursor
            }
            onPress={() => {
              const next = group.data?.next_cursor;
              if (next) {
                setCursors((values) => [...values.slice(0, page + 1), next]);
                setPage((value) => value + 1);
              }
            }}
          >
            {t(($) => $.people.next)}
          </Button>
        </div>
        {editing && (
          <>
            <form
              aria-label={t(($) => $.schedule.addMember)}
              onSubmit={(event) => {
                event.preventDefault();
                if (!locked) {
                  reset();
                  setPersonId("");
                  setSaleId("");
                  setPeopleCursors([undefined]);
                  setPeoplePage(0);
                  setQuery(search.trim());
                }
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="group-person-search">{t(($) => $.people.search)}</FieldLabel>
                  <Input
                    id="group-person-search"
                    name="query"
                    value={search}
                    disabled={locked || Boolean(prepared)}
                    onChange={(event) => setSearch(event.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <Button type="submit" variant="outline" isDisabled={locked || Boolean(prepared)}>
                  {t(($) => $.scheduleRoster.search)}
                </Button>
              </FieldGroup>
            </form>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="group-person">{t(($) => $.schedule.addMember)}</FieldLabel>
                <NativeSelect
                  id="group-person"
                  value={personId}
                  disabled={locked || Boolean(prepared) || people.isError}
                  onChange={(event) => {
                    reset();
                    setPersonId(event.target.value);
                    setSaleId("");
                  }}
                >
                  <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
                  {!people.isError &&
                    people.data?.items.map((person) => (
                      <NativeSelectOption key={person.id} value={person.id}>
                        {person.display_name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
                <FieldDescription>{t(($) => $.scheduleRoster.searchHint)}</FieldDescription>
              </Field>
              <div
                role="group"
                aria-label={t(($) => $.people.pagination)}
                className="flex flex-wrap gap-2"
              >
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={locked || Boolean(prepared) || peoplePage === 0 || people.isFetching}
                  onPress={() => {
                    reset();
                    setPersonId("");
                    setSaleId("");
                    setPeoplePage((value) => value - 1);
                  }}
                >
                  {t(($) => $.people.previous)}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={
                    locked ||
                    Boolean(prepared) ||
                    people.isError ||
                    people.isFetching ||
                    !people.data?.next_cursor
                  }
                  onPress={() => {
                    const next = people.data?.next_cursor;
                    if (next) {
                      reset();
                      setPersonId("");
                      setSaleId("");
                      setPeopleCursors((values) => [...values.slice(0, peoplePage + 1), next]);
                      setPeoplePage((value) => value + 1);
                    }
                  }}
                >
                  {t(($) => $.people.next)}
                </Button>
              </div>
              <Field>
                <FieldLabel htmlFor="group-sale">{t(($) => $.scheduleRoster.sale)}</FieldLabel>
                <NativeSelect
                  id="group-sale"
                  value={saleId}
                  disabled={locked || Boolean(prepared) || rights.isError}
                  onChange={(event) => {
                    reset();
                    setSaleId(event.target.value);
                  }}
                >
                  <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
                  {sales.map((sale) => (
                    <NativeSelectOption key={sale.sale_id} value={sale.sale_id}>
                      {sale.start_date} – {sale.end_date} · {sale.sale_id.slice(-8)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="group-session">
                  {t(($) => $.scheduleRoster.session)}
                </FieldLabel>
                <NativeSelect
                  id="group-session"
                  value={sessionId}
                  disabled={locked || Boolean(prepared) || sessions.isError}
                  onChange={(event) => {
                    reset();
                    setSessionId(event.target.value);
                  }}
                >
                  <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
                  {targets.map((session) => (
                    <NativeSelectOption key={session.id} value={session.id}>
                      {format(session.starts_at, session.ends_at)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </FieldGroup>
            {!prepared && (
              <Button
                isDisabled={locked || !selectedPerson || !saleId || !sessionId}
                onPress={() => {
                  void prepare();
                }}
              >
                {t(($) => $.scheduleRoster.review)}
              </Button>
            )}
            {prepared && (
              <>
                <Alert>
                  <AlertDescription>
                    {prepared.person} · {prepared.sale} ·{" "}
                    {format(prepared.session.starts_at, prepared.session.ends_at)}
                  </AlertDescription>
                </Alert>
                <Checkbox
                  isSelected={accepted}
                  isDisabled={locked || command.state !== "ready"}
                  onChange={setAccepted}
                >
                  {t(($) => $.scheduleRoster.accepted)}
                </Checkbox>
                <Button
                  isDisabled={locked || !accepted || command.state !== "ready"}
                  onPress={() => {
                    if (accepted) void command.start(prepared.intent);
                  }}
                >
                  {t(($) => $.schedule.addMember)}
                </Button>
              </>
            )}
            {statusText && (
              <Alert role="status">
                <AlertDescription>{statusText}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {["unknown", "pending", "saved-unread"].includes(command.state) && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  isDisabled={command.busy}
                  onPress={() => {
                    void command.readReceipt();
                  }}
                >
                  {t(($) => $.products.readAgain)}
                </Button>
                {command.state === "unknown" && (
                  <Button
                    variant="outline"
                    isDisabled={command.busy}
                    onPress={() => {
                      void command.retry();
                    }}
                  >
                    {t(($) => $.products.retryWrite)}
                  </Button>
                )}
              </div>
            )}
            {prepared && !command.locked && (
              <Button variant="outline" onPress={reset}>
                {t(($) => $.scheduleRoster.newAction)}
              </Button>
            )}
          </>
        )}
      </div>
      {cancel && (
        <CancelReservation
          scope={scope}
          personId={cancel.personId}
          reservationId={cancel.reservation.id}
          sessionId={cancel.reservation.session_id}
          label={`${cancel.name} · ${format(cancel.reservation.starts_at, cancel.reservation.ends_at)}`}
          sourceAvailable={!group.isError}
          onClose={() => setCancel(undefined)}
          onAccessLost={onAccessLost}
          onLockChange={setCancelLocked}
          onRefresh={async () => {
            await Promise.all([refreshRoster(), onRefresh()]);
          }}
        />
      )}
    </>
  );
}
