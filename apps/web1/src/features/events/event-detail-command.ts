import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { Operations } from "../../lib/api-contracts/operations";
import type {
  EventView,
  EventRegistrationView,
  EventDutyView,
  AttendanceResult,
  Preview,
  ManagementSelector,
} from "../../lib/api-contracts/generated";
import { getTemporal } from "../../lib/temporal";
import { readEvent } from "./events-read";
import { eventWallInstant } from "./event-command";

type EventOperation =
  | "event_publish_v1"
  | "event_complete_v1"
  | "event_cancel_apply_v1"
  | "event_registration_cancel_v1"
  | "event_attendance_mark_v1"
  | "event_attendance_correct_v1"
  | "event_attendance_close_v1"
  | "event_actual_start_record_v1"
  | "event_actual_start_correct_v1"
  | "event_duty_verify_v1";
type Snapshot = Pick<
  EventView,
  "id" | "center_id" | "version" | "state" | "attendance_state" | "timezone" | "actual_started_at"
>;
export type EventActionIntent = {
  [K in EventOperation]: {
    operation: K;
    request: Omit<Operations[K]["request"], "request_id">;
    scope: ClientScope;
    before: Snapshot;
    registration?: EventRegistrationView;
    duty?: EventDutyView;
  };
}[EventOperation];
export type EventActionInput =
  | { action: "publish" | "complete" | "close_attendance" }
  | { action: "cancel_registration"; id: string; reason: string }
  | {
      action: "mark" | "correct_attendance";
      id: string;
      result: AttendanceResult;
      reason: string;
      recordIneligible: boolean;
    }
  | {
      action: "record_start" | "correct_start" | "clear_start";
      actual: string;
      offset: string;
      reason: string;
    }
  | { action: "verify_duty"; id: string; performed: boolean; reason: string };
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
const snapshot = (event: EventView): Snapshot => ({
  id: event.id,
  center_id: event.center_id,
  version: event.version,
  state: event.state,
  attendance_state: event.attendance_state,
  timezone: event.timezone,
  actual_started_at: event.actual_started_at,
});
const reason = (value: string) => z.string().trim().min(1).parse(value);
const conflict = () =>
  new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
async function freshEvent(scope: ClientScope, before: EventView) {
  const current = await readEvent(scope, before.id);
  if (before.center_id !== scope.centerId || current.version !== before.version) throw conflict();
  return current;
}
async function actionAuthority(
  scope: ClientScope,
  selector: ManagementSelector,
  entity: string,
  id: string,
) {
  const backend = await scopedBackend(scope);
  const source = await backend.call("management_state_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
    operation: selector.operation,
    selector,
    page: { limit: 2 },
  });
  if (
    source.next_cursor ||
    source.items.length !== 1 ||
    !source.items[0]!.exists ||
    source.items[0]!.operation !== selector.operation ||
    source.items[0]!.entity?.type !== entity ||
    source.items[0]!.entity?.id !== id
  )
    throw new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: uuidv7() });
}
export async function previewEventCancellation(
  scope: ClientScope,
  before: EventView,
  explanation: string,
) {
  await freshEvent(scope, before);
  const backend = await scopedBackend(scope);
  const preview = await backend.call("event_cancel_preview_v1", {
    ...common(scope),
    request_id: uuidv7(),
    event_id: before.id,
    reason: reason(explanation),
  });
  z.uuid().parse(preview.id);
  z.string().min(1).parse(preview.token);
  z.iso.datetime({ offset: true }).parse(preview.expires_at);
  if (
    !preview.dependencies.versions.some(
      (row) =>
        row.entity.type === "events" &&
        row.entity.id === before.id &&
        row.version === before.version,
    )
  )
    throw new Error("EVENT_PREVIEW_UNAVAILABLE");
  return preview;
}
export function eventCancellationIntent(
  scope: ClientScope,
  before: EventView,
  preview: Preview,
  reviewed: boolean,
): EventActionIntent {
  if (
    !reviewed ||
    before.center_id !== scope.centerId ||
    preview.blockers.length ||
    Date.parse(preview.expires_at) <= Date.now() ||
    !preview.dependencies.versions.some(
      (row) =>
        row.entity.type === "events" &&
        row.entity.id === before.id &&
        row.version === before.version,
    )
  )
    throw new Error("EVENT_REVIEW_REQUIRED");
  return {
    scope: { ...scope },
    before: snapshot(before),
    operation: "event_cancel_apply_v1",
    request: {
      ...common(scope),
      operation_key: uuidv7(),
      preview: { id: z.uuid().parse(preview.id), token: z.string().min(1).parse(preview.token) },
    },
  };
}
export async function prepareEventAction(
  scope: ClientScope,
  before: EventView,
  input: EventActionInput,
  reviewed: boolean,
): Promise<EventActionIntent> {
  if (!reviewed) throw new Error("EVENT_REVIEW_REQUIRED");
  const current = await freshEvent(scope, before),
    base = { scope: { ...scope }, before: snapshot(before) },
    request = { ...common(scope), operation_key: uuidv7() };
  switch (input.action) {
    case "publish":
      await actionAuthority(
        scope,
        { operation: "event_publish_v1", key: { event_id: current.id } },
        "events",
        current.id,
      );
      return {
        ...base,
        operation: "event_publish_v1",
        request: { ...request, event_id: current.id, published: true },
      };
    case "complete":
      await actionAuthority(
        scope,
        { operation: "event_complete_v1", key: { event_id: current.id } },
        "events",
        current.id,
      );
      return {
        ...base,
        operation: "event_complete_v1",
        request: { ...request, event_id: current.id },
      };
    case "close_attendance":
      await actionAuthority(
        scope,
        { operation: "event_attendance_close_v1", key: { event_id: current.id } },
        "events",
        current.id,
      );
      return {
        ...base,
        operation: "event_attendance_close_v1",
        request: { ...request, event_id: current.id, expected_version: current.version },
      };
    case "record_start":
    case "correct_start":
    case "clear_start": {
      const T = await getTemporal();
      const priorLocal = current.actual_started_at
        ? T.Instant.from(current.actual_started_at).toZonedDateTimeISO(current.timezone)
        : undefined;
      const unchanged =
        priorLocal &&
        priorLocal.toPlainDateTime().toString({ smallestUnit: "minute" }) === input.actual &&
        (!input.offset || input.offset === priorLocal.offset);
      const actual =
        input.action === "clear_start"
          ? null
          : unchanged
            ? current.actual_started_at!
            : await eventWallInstant(current.timezone, input.actual, input.offset);
      const operation =
        input.action === "record_start"
          ? "event_actual_start_record_v1"
          : "event_actual_start_correct_v1";
      if (operation === "event_actual_start_record_v1") {
        await actionAuthority(
          scope,
          { operation, key: { event_id: current.id } },
          "events",
          current.id,
        );
        return {
          ...base,
          operation,
          request: {
            ...request,
            event_id: current.id,
            expected_version: current.version,
            actual_started_at: z.string().parse(actual),
            reason: reason(input.reason),
          },
        };
      }
      await actionAuthority(
        scope,
        { operation, key: { event_id: current.id } },
        "events",
        current.id,
      );
      return {
        ...base,
        operation,
        request: {
          ...request,
          event_id: current.id,
          expected_version: current.version,
          actual_started_at: actual,
          reason: reason(input.reason),
        },
      };
    }
    case "verify_duty": {
      const duty = current.duties?.find((row) => row.id === input.id),
        prior = before.duties?.find((row) => row.id === input.id);
      if (!duty || !prior || duty.version !== prior.version) throw conflict();
      if (duty.verified_at && duty.performed !== input.performed) reason(input.reason);
      await actionAuthority(
        scope,
        { operation: "event_duty_verify_v1", key: { assignment_id: duty.id } },
        "event_assignments",
        duty.id,
      );
      return {
        ...base,
        duty: { ...duty },
        operation: "event_duty_verify_v1",
        request: {
          ...request,
          assignment_id: duty.id,
          performed: input.performed,
          expected_version: duty.version,
          ...(input.reason.trim() ? { reason: input.reason.trim() } : {}),
        },
      };
    }
    case "cancel_registration":
    case "mark":
    case "correct_attendance": {
      const registration = current.registrations?.find((row) => row.id === input.id),
        prior = before.registrations?.find((row) => row.id === input.id);
      if (!registration || !prior || registration.version !== prior.version) throw conflict();
      const context = { ...base, registration: { ...registration } };
      if (input.action === "cancel_registration") {
        await actionAuthority(
          scope,
          { operation: "event_registration_cancel_v1", key: { registration_id: registration.id } },
          "event_registrations",
          registration.id,
        );
        return {
          ...context,
          operation: "event_registration_cancel_v1",
          request: {
            ...request,
            registration_id: registration.id,
            expected_version: registration.version,
            reason: reason(input.reason),
          },
        };
      }
      const result = z.enum(["unmarked", "attended", "no_show", "blocked"]).parse(input.result);
      if (input.recordIneligible && result !== "attended") throw new Error("EVENT_INVALID");
      const override = input.recordIneligible
        ? { record_ineligible_attendance: true, reason: reason(input.reason) }
        : {};
      if (input.action === "correct_attendance") {
        await actionAuthority(
          scope,
          { operation: "event_attendance_correct_v1", key: { registration_id: registration.id } },
          "event_registrations",
          registration.id,
        );
        return {
          ...context,
          operation: "event_attendance_correct_v1",
          request: {
            ...request,
            registration_id: registration.id,
            expected_version: registration.version,
            result,
            reason: reason(input.reason),
            ...override,
          },
        };
      }
      await actionAuthority(
        scope,
        { operation: "event_attendance_mark_v1", key: { registration_id: registration.id } },
        "event_registrations",
        registration.id,
      );
      return {
        ...context,
        operation: "event_attendance_mark_v1",
        request: {
          ...request,
          registration_id: registration.id,
          expected_version: registration.version,
          result,
          ...override,
        },
      };
    }
  }
}
export async function writeEventAction(intent: EventActionIntent) {
  const backend = await scopedBackend(intent.scope),
    request_id = uuidv7();
  switch (intent.operation) {
    case "event_publish_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "event_complete_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "event_cancel_apply_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "event_registration_cancel_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "event_attendance_mark_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "event_attendance_correct_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "event_attendance_close_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "event_actual_start_record_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "event_actual_start_correct_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "event_duty_verify_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
  }
}
function target(intent: EventActionIntent) {
  return intent.registration
    ? { type: "event_registrations", id: intent.registration.id }
    : intent.duty
      ? { type: "event_assignments", id: intent.duty.id }
      : { type: "events", id: intent.before.id };
}
export async function readEventActionReceipt(intent: EventActionIntent) {
  const backend = await scopedBackend(intent.scope),
    expected = target(intent);
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  if (
    receipt.operation !== intent.operation ||
    receipt.key !== intent.request.operation_key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== expected.type ||
        receipt.result_reference.id !== expected.id))
  )
    throw new Error("EVENT_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readEventActionResult(intent: EventActionIntent, id?: string) {
  const expected = target(intent);
  if (z.uuid().parse(id) !== expected.id) throw new Error("EVENT_RESULT_UNREAD");
  const event = await readEvent(intent.scope, intent.before.id);
  const registration = intent.registration
    ? event.registrations?.find(
        (row) =>
          row.id === intent.registration!.id && row.person_id === intent.registration!.person_id,
      )
    : undefined;
  const duty = intent.duty
    ? event.duties?.find(
        (row) => row.id === intent.duty!.id && row.person_id === intent.duty!.person_id,
      )
    : undefined;
  if (
    (intent.registration &&
      (!registration || registration.version <= intent.registration.version)) ||
    (intent.duty && (!duty || duty.version <= intent.duty.version)) ||
    (!intent.registration && !intent.duty && event.version <= intent.before.version)
  )
    throw new Error("EVENT_RESULT_UNREAD");
  const T = await getTemporal();
  switch (intent.operation) {
    case "event_publish_v1":
      if (event.state !== "published") throw new Error("EVENT_RESULT_UNREAD");
      break;
    case "event_complete_v1":
      if (event.state !== "occurred") throw new Error("EVENT_RESULT_UNREAD");
      break;
    case "event_cancel_apply_v1":
      if (
        event.state !== "cancelled" ||
        event.registrations?.some((row) => row.state !== "cancelled")
      )
        throw new Error("EVENT_RESULT_UNREAD");
      break;
    case "event_attendance_close_v1":
      if (event.attendance_state !== "closed") throw new Error("EVENT_RESULT_UNREAD");
      break;
    case "event_registration_cancel_v1":
      if (registration?.state !== "cancelled") throw new Error("EVENT_RESULT_UNREAD");
      break;
    case "event_attendance_mark_v1":
    case "event_attendance_correct_v1":
      if (
        registration?.attendance_result !== intent.request.result ||
        (intent.request.record_ineligible_attendance &&
          registration.package_eligible_at_attendance !== false)
      )
        throw new Error("EVENT_RESULT_UNREAD");
      break;
    case "event_duty_verify_v1":
      if (duty?.performed !== intent.request.performed || !duty.verified_at)
        throw new Error("EVENT_RESULT_UNREAD");
      break;
    case "event_actual_start_record_v1":
    case "event_actual_start_correct_v1":
      if (
        intent.request.actual_started_at === null
          ? event.actual_started_at != null
          : !event.actual_started_at ||
            T.Instant.compare(event.actual_started_at, intent.request.actual_started_at) !== 0
      )
        throw new Error("EVENT_RESULT_UNREAD");
      break;
  }
  return event;
}
