import { useWorkspaceQuery } from "../workspace/workspace-query";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { capturePrivateReadback } from "../../lib/cache-invalidation";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { BackendError, queryBackendRead } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { EventView } from "@ftksaas/api-contracts";
import { getTemporal } from "../../lib/temporal";
import { formatMinorAmount } from "../../lib/money";

import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { EventDetailView, type EventDetailAction } from "./event-detail-view";
import { EventAttendanceView, type EventAttendanceAction } from "./event-attendance-view";
import { EventActionController, type EventActionSelection } from "./event-action-controller";
import { EventEditor } from "./event-editor";
import { studioRoomsQuery } from "../studio/studio-rooms-query";
import { EventRegistrationController } from "./event-registration-controller";
import { eventDetailQuery, invalidateEventViews, type EventWriteEffects } from "./event-query";

export function EventDetailContent({
  scope,
  eventId,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  eventId: string;
  onLockChange: (value: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient();
  const [tab, setTab] = useState<"participants" | "attendance">("participants"),
    [attendanceDraft, setAttendanceDraft] = useState<{
      version: EventView["version"];
      actual?: string;
      reason?: string;
    }>(),
    [locked, setLocked] = useState(false),
    [edit, setEdit] = useState(false),
    [registration, setRegistration] = useState<{ event: EventView; id?: string }>(),
    [action, setAction] = useState<{ before: EventView; selection: EventActionSelection }>();
  const workspace = useWorkspaceQuery(scope.accountId, scope.orgId, false);
  const center =
    (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
      ? workspace.data.centers.find((row) => row.id === scope.centerId && row.accessible)
      : undefined;
  const source = useQuery({
    ...eventDetailQuery(scope, eventId),
    enabled: !!center,
    refetchOnMount: "always",
  });
  const event =
    center && !workspace.isError && !source.isError && source.isFetchedAfterMount
      ? source.data
      : undefined;
  const eventUnavailable = !event;
  const rooms = useQuery({
    ...studioRoomsQuery(scope),
    enabled: event?.venue.kind === "internal" && !!event.venue.room_id,
  });
  const scopeIds = [scope.accountId, scope.orgId, scope.centerId] as const;
  const dutyIds = [...new Set((event?.duties ?? []).map((row) => row.person_id))].sort();
  const dutyNames = useQuery({
    queryKey: ["event-duty-persons", ...scopeIds, eventId, dutyIds],
    enabled: dutyIds.length > 0,
    retry: false,
    queryFn: async (readContext) => {
      const names = new Map<string, string>();
      const backend = await scopedBackend(scope, undefined, readContext);
      // Only the event's known duty subjects, never the complete organization directory.
      for (let index = 0; index < dutyIds.length; index += 4)
        await Promise.all(
          dutyIds.slice(index, index + 4).map(async (id) => {
            try {
              const person = await queryBackendRead(
                backend,
                "person_get_v1",
                {
                  client_api_version: 1,
                  request_id: uuidv7(),
                  org_id: scope.orgId,
                  person_id: id,
                },
                readContext.signal,
              );
              if (person.id !== id) throw new Error("EVENT_PERSON_UNAVAILABLE");
              names.set(id, person.display_name);
            } catch (cause) {
              if (
                !(cause instanceof BackendError && ["FORBIDDEN", "NOT_FOUND"].includes(cause.code))
              )
                throw cause;
            }
          }),
        );
      return names;
    },
  });
  const presentation = useQuery({
    queryKey: [
      "event-times",
      ...scopeIds,
      eventId,
      event?.timezone,
      event?.interval.starts_at,
      event?.interval.ends_at,
      event?.actual_started_at,
    ],
    enabled: !!event,
    retry: false,
    queryFn: async () => {
      const T = await getTemporal(),
        value = event!;
      const fmt = new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: value.timezone,
      });
      return {
        planned: fmt.format(new Date(value.interval.starts_at)),
        end: fmt.format(new Date(value.interval.ends_at)),
        actual: value.actual_started_at
          ? T.Instant.from(value.actual_started_at)
              .toZonedDateTimeISO(value.timezone)
              .toPlainDateTime()
              .toString({ smallestUnit: "minute" })
          : "",
      };
    },
  });
  const info = presentation.isError ? undefined : presentation.data;
  const draft = attendanceDraft?.version === event?.version ? attendanceDraft : undefined;
  const accessLost = useCallback(
    (cause: unknown) => {
      if (
        (cause instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.code)) ||
        (cause instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(cause.message))
      ) {
        queries.removeQueries({ queryKey: ["event-detail", scope.accountId] });
        void router.invalidate();
        return true;
      }
      return false;
    },
    [queries, router, scope.accountId],
  );
  useEffect(() => {
    for (const cause of [workspace.error, source.error, rooms.error, dutyNames.error])
      if (cause) accessLost(cause);
  }, [workspace.error, source.error, rooms.error, dutyNames.error, accessLost]);
  const setPending = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  async function refresh(afterWrite: EventWriteEffects) {
    const assertCurrent = capturePrivateReadback(queries);
    await invalidateEventViews(queries, scope, eventId, afterWrite);
    assertCurrent();
    if (!afterWrite.detailVerified) await source.refetch({ throwOnError: true });
    assertCurrent();
    setAttendanceDraft(undefined);
  }
  function choose(selection: EventActionSelection) {
    if (event && !locked) setAction({ before: structuredClone(event), selection });
  }
  function detailAction(value: EventDetailAction, id?: string) {
    if (!event || locked) return;
    if (value === "edit") setEdit(true);
    else if (value === "register" || value === "payment")
      setRegistration({ event: structuredClone(event), ...(id ? { id } : {}) });
    else if (value === "publish" || value === "complete") choose({ action: value });
    else if (value === "cancel") choose({ action: value, reason: "" });
    else if (value === "cancel_registration" && id) choose({ action: value, id, reason: "" });
    else if (value === "verify_duty" && id) choose({ action: value, id, reason: "" });
  }
  function attendanceAction(value: EventAttendanceAction) {
    if (!info) return;
    if (value === "record_start" || value === "correct_start" || value === "clear_start")
      choose({
        action: value,
        actual: draft?.actual ?? info.actual,
        offset: "",
        reason: draft?.reason ?? "",
      });
    else if (value === "close_attendance") choose({ action: value });
    else
      choose({
        action: "correct_attendance",
        id: "",
        result: "unmarked",
        reason: "",
        recordIneligible: false,
      });
  }
  const unknown = t(($) => $.events.unknown),
    allowed = event?.state === "published" || event?.state === "occurred";
  const hasHistory = !!event?.actual_start_history?.length || !!event?.actual_started_at;
  const attendanceActions: EventAttendanceAction[] = !event
    ? []
    : [
        ...(allowed || event.state === "cancelled"
          ? hasHistory
            ? (["correct_start", "clear_start"] as const)
            : event.actual_start_history !== undefined
              ? (["record_start"] as const)
              : (["record_start", "correct_start"] as const)
          : []),
        ...(allowed && event.attendance_state === "open" ? (["close_attendance"] as const) : []),
        ...(event.attendance_state === "closed" ? (["correct_attendance"] as const) : []),
      ];
  function renderDetail(event: EventView) {
    const pendingTime = presentation.isError ? unknown : t(($) => $.studio.loading);
    const enabledActions: EventDetailAction[] = [
      "edit",
      ...(event.state === "draft" ? (["publish"] as const) : []),
      ...(event.state === "published" ? (["complete", "register"] as const) : []),
      ...(event.state !== "cancelled" ? (["cancel", "cancel_registration"] as const) : []),
      ...(event.state === "occurred" ? (["verify_duty"] as const) : []),
      "payment",
    ];
    return (
      <EventDetailView
        name={event.name}
        state={event.state}
        kind={
          event.terms.package_usage === "eligibility_only"
            ? t(($) => $.events.editor.practice)
            : t(($) => $.events.editor.workshop)
        }
        facts={[
          { label: t(($) => $.eventDetail.planned), value: info?.planned ?? pendingTime },
          { label: t(($) => $.events.editor.ends), value: info?.end ?? pendingTime },
          {
            label: t(($) => $.events.editor.venue),
            value:
              event.venue.kind === "external"
                ? event.venue.name || unknown
                : ((!rooms.isError ? rooms.data : undefined)?.find(
                    (room) => room.active && room.id === event.venue.room_id,
                  )?.name ?? unknown),
          },
          { label: t(($) => $.events.editor.timezone), value: event.timezone },
        ]}
        rows={
          event.registrations?.map((row) => {
            const payment = row.payment_summary;
            return {
              id: row.id,
              name: row.display_name,
              initials: row.display_name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join(""),
              rights:
                row.package_eligible === true
                  ? t(($) => $.eventDetail.eligible)
                  : row.package_eligible === false
                    ? t(($) => $.eventDetail.ineligible)
                    : unknown,
              payment:
                payment?.status === "available" || payment?.status === "no_cash_due"
                  ? formatMinorAmount(payment.remaining_minor!, payment.currency!)
                  : payment
                    ? t(($) => $.eventDetail.paymentStates[payment.status])
                    : t(($) => $.eventDetail.paymentUnread),
              attendance: t(($) => $.eventDetail.results[row.attendance_result]),
              warning:
                row.state === "cancelled"
                  ? t(($) => $.eventDetail.registrationState.cancelled)
                  : undefined,
              cancelled: row.state !== "active",
              paymentAvailable: Boolean(payment && payment.status !== "restricted"),
            };
          }) ?? null
        }
        duties={
          event.duties?.map((row) => ({
            id: row.id,
            name: (!dutyNames.isError ? dutyNames.data?.get(row.person_id) : undefined) ?? unknown,
            duty:
              row.duty === "instructor"
                ? t(($) => $.events.editor.instructor)
                : t(($) => $.events.editor.assistant),
            fee: formatMinorAmount(row.fee_minor, row.currency),
            state: row.verified_at
              ? row.performed
                ? t(($) => $.eventDetail.dutyPerformed)
                : t(($) => $.eventDetail.dutyNotPerformed)
              : t(($) => $.eventDetail.dutyUnverified),
            canVerify: event.state === "occurred",
          })) ?? null
        }
        capacity={
          <p className="tabular-nums">
            {event.registrations
              ? event.registrations.filter((row) => row.state === "active").length
              : "—"}{" "}
            / {"kind" in event.capacity ? t(($) => $.events.unlimited) : event.capacity.maximum}
          </p>
        }
        conditions={
          <div className="space-y-3 text-sm">
            <p>
              {t(($) => $.eventDetail.fee)}:{" "}
              {formatMinorAmount(event.terms.fee_minor, event.terms.currency)}
            </p>
            <p>
              {event.terms.full_payment_required
                ? t(($) => $.eventDetail.fullPayment)
                : t(($) => $.eventDetail.partialPayment)}
            </p>
            {event.terms.package_usage === "eligibility_only" && (
              <p>{t(($) => $.eventDetail.notConsumption)}</p>
            )}
            <dl className="space-y-2">
              {(["before_cutoff", "after_cutoff", "no_show"] as const).map((key) => (
                <div key={key}>
                  <dt className="text-muted-foreground">
                    {key === "before_cutoff"
                      ? t(($) => $.events.editor.before)
                      : key === "after_cutoff"
                        ? t(($) => $.events.editor.after)
                        : t(($) => $.events.editor.noShow)}
                  </dt>
                  <dd>
                    {event.terms.cancellation[key] === "release"
                      ? t(($) => $.events.editor.release)
                      : t(($) => $.events.editor.consume)}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="text-muted-foreground">{t(($) => $.events.editor.cutoff)}</dt>
                <dd>{event.terms.cancellation.cutoff_minutes ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t(($) => $.events.editor.refund)}</dt>
                <dd>{t(($) => $.events.refunds[event.terms.refund.method])}</dd>
              </div>
            </dl>
          </div>
        }
        attendance={
          <EventAttendanceView
            planned={info?.planned ?? pendingTime}
            actual={draft?.actual ?? info?.actual ?? ""}
            onActual={(value) =>
              setAttendanceDraft({ ...draft, version: event.version, actual: value })
            }
            reason={draft?.reason ?? ""}
            onReason={(value) =>
              setAttendanceDraft({ ...draft, version: event.version, reason: value })
            }
            rows={
              event.registrations?.map((row) => ({
                id: row.id,
                name: row.display_name,
                result: row.attendance_result,
                detail: t(($) => $.eventDetail.registrationState[row.state]),
                disabled: row.state !== "active" || !allowed,
              })) ?? null
            }
            closed={event.attendance_state === "closed"}
            onMark={(id, result) =>
              choose({ action: "mark", id, result, reason: "", recordIneligible: false })
            }
            onAction={attendanceAction}
            enabledActions={attendanceActions}
            locked={locked || !info}
          />
        }
        backHref={`/o/${scope.orgId}/c/${scope.centerId}/events`}
        tab={tab}
        onTab={setTab}
        onAction={detailAction}
        enabledActions={enabledActions}
        locked={locked}
        notice={
          <>
            {presentation.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {t(($) => $.events.sourceError)}
                  <Button variant="outline" onPress={() => void presentation.refetch()}>
                    {t(($) => $.events.reload)}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <Alert>
              <AlertDescription>{t(($) => $.eventDetail.sourceLimit)}</AlertDescription>
            </Alert>
          </>
        }
      />
    );
  }
  return (
    <>
      {event ? (
        renderDetail(event)
      ) : (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t(($) => $.eventDetail.title)}</h1>
          <Alert variant={source.isError || presentation.isError ? "destructive" : "default"}>
            <AlertDescription>
              {source.isError || presentation.isError
                ? t(($) => $.events.sourceError)
                : t(($) => $.studio.loading)}
            </AlertDescription>
          </Alert>
          <Button
            onPress={() => {
              void source.refetch();
            }}
          >
            {t(($) => $.events.reload)}
          </Button>
        </div>
      )}
      {edit && (event || locked) && (
        <EventEditor
          scope={scope}
          target={eventId}
          timezone={event?.timezone ?? source.data?.timezone ?? "UTC"}
          recoveryOnly={eventUnavailable}
          onClose={() => setEdit(false)}
          onSaved={() => refresh({})}
          onLockChange={setPending}
          onAccessLost={accessLost}
        />
      )}
      {action && (event || locked) && (
        <EventActionController
          scope={scope}
          before={action.before}
          selection={action.selection}
          recoveryOnly={eventUnavailable}
          onClose={() => {
            if (!locked) setAction(undefined);
          }}
          onReload={() => {
            setAction(undefined);
            void source.refetch();
          }}
          onSaved={() => {
            const selection = action.selection;
            const finance = [
              "cancel",
              "cancel_registration",
              "complete",
              "close_attendance",
              "correct_attendance",
            ].includes(selection.action);
            return refresh({
              finance,
              productRights: finance,
              personId:
                selection.action === "cancel_registration"
                  ? action.before.registrations?.find((row) => row.id === selection.id)?.person_id
                  : undefined,
              earnings: [
                "verify_duty",
                "cancel",
                "complete",
                "close_attendance",
                "correct_attendance",
              ].includes(action.selection.action),
            });
          }}
          onLockChange={setPending}
          onAccessLost={accessLost}
        />
      )}
      {registration && (event || locked) && (
        <EventRegistrationController
          scope={scope}
          before={registration.event}
          registrationId={registration.id}
          recoveryOnly={eventUnavailable}
          selfPersonId={center ? workspace.data?.selected?.self_context?.person_id : undefined}
          onClose={() => {
            if (!locked) setRegistration(undefined);
          }}
          onSaved={(detailVerified, personId) =>
            refresh({ finance: true, detailVerified, personId })
          }
          onLockChange={setPending}
          onAccessLost={accessLost}
        />
      )}
    </>
  );
}
