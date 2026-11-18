import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { formatMinorAmount } from "../../lib/money";
import { getTemporal } from "../../lib/temporal";
import { hasWorkspaceManagementScope, readWorkspace } from "../workspace/workspace";
import { EventsView, type EventRow, type EventFilter } from "./events-view";
import { EventEditor } from "./event-editor";
import { eventMonth, readEventsPage, readEventRooms } from "./events-read";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Field, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";

export function EventsContent({
  scope,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  onLockChange: (value: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState<EventFilter>("all"),
    [month, setMonth] = useState<string>(),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [pageIndex, setPageIndex] = useState(0),
    [locked, setLocked] = useState(false),
    [selected, setSelected] = useState<string | null | undefined>();
  const workspace = useQuery({
    queryKey: ["workspace", scope.accountId, scope.orgId],
    queryFn: () => readWorkspace(scope.accountId, scope.orgId),
    enabled: false,
    retry: false,
  });
  const center =
    (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
      ? workspace.data.centers.find((row) => row.id === scope.centerId && row.accessible)
      : undefined;
  const canReadSummary =
    !workspace.isError && hasWorkspaceManagementScope(workspace.data, scope.centerId);
  const prefix = ["events", scope.accountId, scope.orgId, scope.centerId];
  const period = useQuery({
    queryKey: ["event-month", center?.timezone, month],
    queryFn: () => eventMonth(center!.timezone, month),
    enabled: !!center,
    retry: false,
  });
  const rooms = useQuery({
    queryKey: ["event-choices", scope.accountId, scope.orgId, scope.centerId, "rooms"],
    queryFn: () => readEventRooms(scope),
    enabled: !!center,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const program = useQuery({
    queryKey: [
      ...prefix,
      period.data?.interval,
      search.trim(),
      filter,
      canReadSummary,
      cursors[pageIndex],
    ],
    enabled: !!center && !!period.data,
    queryFn: async () => {
      const page = await readEventsPage(scope, period.data!.interval, cursors[pageIndex], {
        query: search,
        status: filter,
        includeSummary: canReadSummary,
      });
      if (page.next_cursor && cursors.includes(page.next_cursor))
        throw new Error("EVENT_PAGE_UNAVAILABLE");
      return page;
    },
    retry: false,
  });
  const accessLost = useCallback(
    (cause: unknown) => {
      if (
        (cause instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.code)) ||
        (cause instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(cause.message))
      ) {
        queries.removeQueries({ queryKey: ["events", scope.accountId] });
        queries.removeQueries({ queryKey: ["event-edit", scope.accountId] });
        void router.invalidate();
        return true;
      }
      return false;
    },
    [queries, router, scope.accountId],
  );
  useEffect(() => {
    for (const error of [workspace.error, program.error, rooms.error]) if (error) accessLost(error);
  }, [workspace.error, program.error, rooms.error, accessLost]);
  const presentation = useQuery({
    queryKey: [
      "event-rows",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      program.data,
      rooms.data,
    ],
    enabled: !!program.data && !program.isError,
    queryFn: async () => {
      const T = await getTemporal();
      return program.data!.items.map((row): EventRow => {
        const start = T.Instant.from(row.interval.starts_at).toZonedDateTimeISO(row.timezone),
          end = T.Instant.from(row.interval.ends_at).toZonedDateTimeISO(row.timezone);
        const format = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
        return {
          id: row.id,
          name: row.name,
          kind:
            row.terms.package_usage === "eligibility_only"
              ? t(($) => $.events.editor.practice)
              : t(($) => $.events.editor.workshop),
          day: start.toLocaleString("tr-TR", { day: "numeric", month: "short", year: "numeric" }),
          time: `${start.toLocaleString("tr-TR", format)} – ${end.toLocaleString("tr-TR", format)} · ${row.timezone}`,
          venue:
            row.venue.kind === "external"
              ? (row.venue.name ?? t(($) => $.events.unknown))
              : (rooms.data?.find((room) => room.id === row.venue.room_id)?.name ??
                t(($) => $.events.unknown)),
          registrations: `${row.active_registration_count === undefined ? "—" : row.active_registration_count.toLocaleString("tr-TR")} / ${"kind" in row.capacity ? t(($) => $.events.unlimited) : row.capacity.maximum.toLocaleString("tr-TR")}`,
          fee: formatMinorAmount(row.terms.fee_minor, row.terms.currency),
          state: row.state,
        };
      });
    },
    retry: false,
  });
  const lock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  const summary = !program.isError ? program.data?.summary : undefined;
  return (
    <>
      <EventsView
        rows={!program.isError && !presentation.isError ? (presentation.data ?? null) : null}
        query={search}
        onQuery={(value) => {
          if (!locked) {
            setSearch(value);
            setCursors([undefined]);
            setPageIndex(0);
          }
        }}
        filter={filter}
        onFilter={(value) => {
          if (!locked) {
            setFilter(value);
            setCursors([undefined]);
            setPageIndex(0);
          }
        }}
        filtersAvailable
        summary={{
          published: summary?.published.toLocaleString("tr-TR") ?? null,
          draft: summary?.draft.toLocaleString("tr-TR") ?? null,
          registrations: summary?.published_active_registrations.toLocaleString("tr-TR") ?? null,
          unpaid: summary
            ? summary.pending_payments.length
              ? summary.pending_payments
                  .map(
                    (row) =>
                      `${formatMinorAmount(row.remaining_minor, row.currency)} · ${t(($) => $.events.pendingCount, { count: row.registration_count })}`,
                  )
                  .join(" / ")
              : summary.unresolved_payment_registrations > 0
                ? t(($) => $.events.paymentSummaryIncomplete)
                : t(($) => $.events.noPendingPayments)
            : null,
        }}
        locked={locked}
        onAdd={() => {
          if (center && !locked) setSelected(null);
        }}
        onOpen={(id) => {
          if (!locked)
            void router.navigate({
              to: "/o/$orgId/c/$centerId/events/$eventId",
              params: { orgId: scope.orgId, centerId: scope.centerId, eventId: id },
            });
        }}
        notice={
          <>
            <Field className="max-w-64">
              <FieldLabel htmlFor="events-month">{t(($) => $.events.month)}</FieldLabel>
              <Input
                id="events-month"
                name="month"
                type="month"
                value={month ?? period.data?.month ?? ""}
                disabled={locked}
                onChange={(event) => {
                  setMonth(event.target.value || undefined);
                  setCursors([undefined]);
                  setPageIndex(0);
                }}
              />
            </Field>
            <Alert>
              <AlertDescription>{t(($) => $.events.directoryLimit)}</AlertDescription>
            </Alert>
            {!canReadSummary && <p>{t(($) => $.events.summaryUnavailable)}</p>}
            {summary && summary.unresolved_payment_registrations > 0 && (
              <Alert>
                <AlertDescription>
                  {t(($) => $.events.unresolvedPayments, {
                    count: summary.unresolved_payment_registrations,
                  })}
                </AlertDescription>
              </Alert>
            )}
            {(!center || period.isError || program.isError || presentation.isError) && (
              <Alert variant="destructive">
                <AlertDescription>{t(($) => $.events.sourceError)}</AlertDescription>
              </Alert>
            )}
            <Button
              variant="outline"
              isDisabled={locked || program.isFetching}
              onPress={() => {
                void Promise.all([period.refetch(), program.refetch(), rooms.refetch()]);
              }}
            >
              {t(($) => $.events.reload)}
            </Button>
          </>
        }
        pagination={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              isDisabled={locked || program.isFetching || pageIndex === 0}
              onPress={() => setPageIndex((value) => value - 1)}
            >
              {t(($) => $.lessonRequests.previous)}
            </Button>
            <Button
              variant="outline"
              isDisabled={
                locked || program.isFetching || program.isError || !program.data?.next_cursor
              }
              onPress={() => {
                const next = program.data?.next_cursor;
                if (!next || cursors.includes(next)) return;
                setCursors((values) => [...values.slice(0, pageIndex + 1), next]);
                setPageIndex((value) => value + 1);
              }}
            >
              {t(($) => $.lessonRequests.next)}
            </Button>
          </div>
        }
      />
      {selected !== undefined && center && (
        <EventEditor
          key={selected ?? "new"}
          scope={scope}
          target={selected}
          timezone={center.timezone}
          onClose={() => {
            if (!locked) setSelected(undefined);
          }}
          onLockChange={lock}
          onAccessLost={accessLost}
          onSaved={async () => {
            await queries.invalidateQueries({ queryKey: prefix });
          }}
        />
      )}
    </>
  );
}
