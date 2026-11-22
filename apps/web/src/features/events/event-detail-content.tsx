import { useWorkspaceQuery } from "../workspace/workspace-query";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
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
import { readEventRooms } from "./events-read";
import { readDetailedEvent } from "./event-registration-read";
import { EventRegistrationController } from "./event-registration-controller";

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
    [actual, setActual] = useState<string>(),
    [reason, setReason] = useState(""),
    [locked, setLocked] = useState(false),
    [edit, setEdit] = useState(false),
    [registration, setRegistration] = useState<{ event: EventView; id?: string }>(),
    [action, setAction] = useState<{ before: EventView; selection: EventActionSelection }>();
  const workspace = useWorkspaceQuery(scope.accountId, scope.orgId, false);
  const center =
    (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
      ? workspace.data.centers.find((row) => row.id === scope.centerId && row.accessible)
      : undefined;
  const prefix = ["event-detail", scope.accountId, scope.orgId, scope.centerId, eventId];
  const source = useQuery({
    queryKey: prefix,
    queryFn: () => readDetailedEvent(scope, eventId),
    enabled: !!center,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const event = !source.isError || locked ? source.data : undefined;
  const rooms = useQuery({
    queryKey: ["event-choices", scope.accountId, scope.orgId, scope.centerId, "rooms"],
    queryFn: () => readEventRooms(scope),
    enabled: !!center,
    retry: false,
  });
  const presentation = useQuery({
    queryKey: [...prefix, "presentation", event],
    placeholderData: keepPreviousData,
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
      const names = new Map<string, string>(),
        backend = await scopedBackend(scope);
      // Only the event's known duty subjects, not the organization directory.
      const ids = [...new Set((value.duties ?? []).map((row) => row.person_id))];
      for (let index = 0; index < ids.length; index += 4)
        await Promise.all(
          ids.slice(index, index + 4).map(async (id) => {
            try {
              const person = await backend.call("person_get_v1", {
                client_api_version: 1,
                request_id: uuidv7(),
                org_id: scope.orgId,
                person_id: id,
              });
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
      return {
        names,
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
    for (const cause of [workspace.error, source.error, presentation.error])
      if (cause) accessLost(cause);
  }, [workspace.error, source.error, presentation.error, accessLost]);
  const setPending = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  async function refresh(afterWrite?: { finance?: boolean; earnings?: boolean }) {
    const scopeIds = [scope.accountId, scope.orgId, scope.centerId];
    const affected: (readonly unknown[])[] = [["events", ...scopeIds]];
    if (afterWrite) affected.push(["schedule-range", ...scopeIds]);
    if (afterWrite?.finance) {
      for (const name of [
        "finance-directory",
        "finance-directory-credit-debts",
        "finance",
        "profile-rights",
        "member-entitlements",
        "event-registration-rights",
      ])
        affected.push([name, ...scopeIds]);
    }
    if (afterWrite?.earnings) {
      affected.push(["earnings-directory", scope], ["earnings-visible-counts", scope]);
      affected.push(
        ["instructor-earning-page", ...scopeIds],
        ["instructor-account-payments", ...scopeIds],
      );
    }
    await Promise.all([
      queries.refetchQueries({ queryKey: prefix, exact: true }, { throwOnError: true }),
      ...affected.map((queryKey) => queries.invalidateQueries({ queryKey })),
    ]);
    setActual(undefined);
    setReason("");
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
    if (value === "record_start" || value === "correct_start" || value === "clear_start")
      choose({
        action: value,
        actual: actual ?? presentation.data?.actual ?? "",
        offset: "",
        reason,
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
  if (!event || !presentation.data || presentation.isError)
    return (
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
            void presentation.refetch();
          }}
        >
          {t(($) => $.events.reload)}
        </Button>
      </div>
    );
  const info = presentation.data;
  const enabledActions: EventDetailAction[] = [
    "edit",
    ...(event.state === "draft" ? (["publish"] as const) : []),
    ...(event.state === "published" ? (["complete", "register"] as const) : []),
    ...(event.state !== "cancelled" ? (["cancel", "cancel_registration"] as const) : []),
    ...(event.state === "occurred" ? (["verify_duty"] as const) : []),
    "payment",
  ];
  return (
    <>
      <EventDetailView
        name={event.name}
        state={event.state}
        kind={
          event.terms.package_usage === "eligibility_only"
            ? t(($) => $.events.editor.practice)
            : t(($) => $.events.editor.workshop)
        }
        facts={[
          { label: t(($) => $.eventDetail.planned), value: info.planned },
          { label: t(($) => $.events.editor.ends), value: info.end },
          {
            label: t(($) => $.events.editor.venue),
            value:
              event.venue.kind === "external"
                ? event.venue.name || unknown
                : (rooms.data?.find((room) => room.id === event.venue.room_id)?.name ?? unknown),
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
            name: info.names.get(row.person_id) ?? unknown,
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
            planned={info.planned}
            actual={actual ?? info.actual}
            onActual={setActual}
            reason={reason}
            onReason={setReason}
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
            locked={locked}
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
            <Alert>
              <AlertDescription>{t(($) => $.eventDetail.sourceLimit)}</AlertDescription>
            </Alert>
          </>
        }
      />
      {edit && (
        <EventEditor
          scope={scope}
          target={eventId}
          timezone={event.timezone}
          onClose={() => setEdit(false)}
          onSaved={() => refresh({})}
          onLockChange={setPending}
          onAccessLost={accessLost}
        />
      )}
      {action && (
        <EventActionController
          scope={scope}
          before={action.before}
          selection={action.selection}
          onClose={() => {
            if (!locked) {
              setAction(undefined);
              void refresh();
            }
          }}
          onSaved={() =>
            refresh({
              finance: [
                "cancel",
                "cancel_registration",
                "complete",
                "close_attendance",
                "correct_attendance",
              ].includes(action.selection.action),
              earnings: [
                "verify_duty",
                "cancel",
                "complete",
                "close_attendance",
                "correct_attendance",
              ].includes(action.selection.action),
            })
          }
          onLockChange={setPending}
          onAccessLost={accessLost}
        />
      )}
      {registration && (
        <EventRegistrationController
          scope={scope}
          before={registration.event}
          registrationId={registration.id}
          selfPersonId={center ? workspace.data?.selected?.self_context?.person_id : undefined}
          onClose={() => {
            if (!locked) {
              setRegistration(undefined);
              void refresh();
            }
          }}
          onSaved={() => refresh({ finance: true })}
          onLockChange={setPending}
          onAccessLost={accessLost}
        />
      )}
    </>
  );
}
