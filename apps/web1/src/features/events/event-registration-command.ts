import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  Preview,
  RequestEventRegister,
  RequestEventPaymentPrepare,
  EventPaymentPreparationView,
  EventRegistrationResult,
} from "../../lib/api-contracts/generated";
import {
  readDetailedEvent,
  readEventPayment,
  validateEventPayment,
} from "./event-registration-read";
import {
  readCollectionAuthority,
  collectionIntent,
  financeDraft,
  writeCollection,
  readCollectionReceipt,
  readCollectionResult,
  type CollectionIntent,
} from "../finance/finance";
import type { EventCollectionDraft } from "./event-registration-draft";

const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export interface RegistrationTarget {
  scope: ClientScope;
  eventId: string;
  personId: string;
  saleId?: string;
  preparationId?: string;
}
export interface EventRegistrationIntent {
  operation: "event_register_v1";
  target: RegistrationTarget;
  request: Omit<RequestEventRegister, "request_id">;
}
export interface EventPreparationIntent {
  operation: "event_payment_prepare_v1";
  target: RegistrationTarget;
  request: Omit<RequestEventPaymentPrepare, "request_id">;
}
function targetRequest(target: RegistrationTarget) {
  z.uuid().parse(target.eventId);
  z.uuid().parse(target.personId);
  if (target.saleId && target.preparationId) throw new Error("EVENT_PAYMENT_SCOPE_CHANGED");
  return {
    ...common(target.scope),
    event_id: target.eventId,
    person_id: target.personId,
    ...(target.saleId ? { sale_id: z.uuid().parse(target.saleId) } : {}),
    ...(target.preparationId ? { preparation_id: z.uuid().parse(target.preparationId) } : {}),
  };
}
export async function previewEventRegistration(target: RegistrationTarget) {
  const backend = await scopedBackend(target.scope);
  const preview = await backend.call("event_registration_preview_v1", {
    ...targetRequest(target),
    request_id: uuidv7(),
  });
  z.uuid().parse(preview.id);
  z.string().min(1).parse(preview.token);
  z.iso.datetime({ offset: true }).parse(preview.expires_at);
  if (
    !preview.dependencies.versions.some(
      (row) => row.entity.type === "events" && row.entity.id === target.eventId,
    )
  )
    throw new Error("EVENT_PREVIEW_UNAVAILABLE");
  return preview;
}
export function eventRegistrationIntent(
  target: RegistrationTarget,
  preview: Preview,
  reviewed: boolean,
): EventRegistrationIntent {
  if (
    !reviewed ||
    preview.blockers.length ||
    Date.parse(preview.expires_at) <= Date.now() ||
    !preview.dependencies.versions.some(
      (row) => row.entity.type === "events" && row.entity.id === target.eventId,
    )
  )
    throw new Error("EVENT_REVIEW_REQUIRED");
  return {
    operation: "event_register_v1",
    target: structuredClone(target),
    request: {
      ...targetRequest(target),
      operation_key: uuidv7(),
      preview: { id: z.uuid().parse(preview.id), token: z.string().min(1).parse(preview.token) },
    },
  };
}
export function eventPreparationIntent(
  target: RegistrationTarget,
  reviewed: boolean,
): EventPreparationIntent {
  if (!reviewed || target.saleId || target.preparationId) throw new Error("EVENT_REVIEW_REQUIRED");
  return {
    operation: "event_payment_prepare_v1",
    target: structuredClone(target),
    request: {
      ...common(target.scope),
      operation_key: uuidv7(),
      event_id: z.uuid().parse(target.eventId),
      person_id: z.uuid().parse(target.personId),
    },
  };
}
export async function writeEventRegistration(intent: EventRegistrationIntent) {
  const value: EventRegistrationResult = await (
    await scopedBackend(intent.target.scope)
  ).call(intent.operation, {
    ...intent.request,
    request_id: uuidv7(),
  });
  if (value.outcome === "capacity_closed") {
    if (value.preparation_id !== intent.target.preparationId)
      throw new Error("EVENT_PAYMENT_SCOPE_CHANGED");
    return { primary_id: z.uuid().parse(value.preparation_id) };
  }
  return { primary_id: z.uuid().parse(value.primary_id) };
}
export async function writeEventPreparation(intent: EventPreparationIntent) {
  const value = validateEventPayment(
    await (
      await scopedBackend(intent.target.scope)
    ).call(intent.operation, { ...intent.request, request_id: uuidv7() }),
    intent.target.scope,
    intent.target.eventId,
    intent.target.personId,
  );
  return { primary_id: value.id };
}
export async function readRegistrationReceipt(
  intent: EventRegistrationIntent | EventPreparationIntent,
) {
  const receipt = await (
    await scopedBackend(intent.target.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.target.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  if (
    receipt.operation !== intent.operation ||
    receipt.key !== intent.request.operation_key ||
    (receipt.result_reference &&
      !(
        (intent.operation === "event_payment_prepare_v1" &&
          receipt.result_reference.type === "event_payment_preparations") ||
        (intent.operation === "event_register_v1" &&
          (receipt.result_reference.type === "event_registrations" ||
            (receipt.result_reference.type === "event_payment_preparations" &&
              receipt.result_reference.id === intent.target.preparationId)))
      ))
  )
    throw new Error("EVENT_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readRegistrationResult(intent: EventRegistrationIntent, id?: string) {
  const primary = z.uuid().parse(id),
    event = await readDetailedEvent(intent.target.scope, intent.target.eventId);
  if (intent.target.preparationId && primary === intent.target.preparationId) {
    const payment = await readEventPayment(
      intent.target.scope,
      event.id,
      intent.target.personId,
      primary,
    );
    if (
      payment.state !== "capacity_closed" ||
      payment.registration_id !== null ||
      payment.remaining_minor !== "0"
    )
      throw new Error("EVENT_REGISTRATION_UNREAD");
    return { outcome: "capacity_closed" as const, event, payment };
  }
  const matches = event.registrations?.filter(
    (row) =>
      row.id === primary && row.person_id === intent.target.personId && row.state === "active",
  );
  if (matches?.length !== 1) throw new Error("EVENT_REGISTRATION_UNREAD");
  if (intent.target.preparationId) {
    const payment = await readEventPayment(
      intent.target.scope,
      event.id,
      intent.target.personId,
      intent.target.preparationId,
    );
    if (payment.registration_id !== primary || payment.state !== "registered")
      throw new Error("EVENT_REGISTRATION_UNREAD");
  }
  return { outcome: "registered" as const, event };
}
export async function readPreparationResult(intent: EventPreparationIntent, id?: string) {
  return readEventPayment(
    intent.target.scope,
    intent.target.eventId,
    intent.target.personId,
    z.uuid().parse(id),
  );
}
export type EventCollectionIntent = CollectionIntent & {
  preparation: { id: string; eventId: string; debtId: string };
};
export async function prepareEventCollection(
  scope: ClientScope,
  source: EventPaymentPreparationView,
  timezone: string,
  draft: EventCollectionDraft,
  reviewed: boolean,
): Promise<EventCollectionIntent> {
  if (!reviewed) throw new Error("EVENT_REVIEW_REQUIRED");
  const current = await readEventPayment(scope, source.event_id, source.person_id, source.id);
  if (
    current.debt_id !== source.debt_id ||
    current.version !== source.version ||
    current.currency !== source.currency ||
    current.remaining_minor !== source.remaining_minor ||
    current.paid_minor !== source.paid_minor ||
    current.credited_minor !== source.credited_minor ||
    !["prepared", "registered"].includes(current.state)
  )
    throw new Error("EVENT_PAYMENT_SCOPE_CHANGED");
  if (!(await readCollectionAuthority(scope, current.person_id)))
    throw new Error("FINANCE_AUTHORITY_UNAVAILABLE");
  const selection = { personId: current.person_id, currency: current.currency };
  const intent = await collectionIntent(scope, selection, timezone, {
    ...financeDraft(selection),
    amount: draft.amount,
    method: draft.method,
    reference: draft.reference,
    occurredAt: draft.occurredAt,
    note: draft.note,
  });
  intent.request.debt_ids = [current.debt_id];
  return {
    ...intent,
    preparation: { id: current.id, eventId: current.event_id, debtId: current.debt_id },
  };
}
export async function readEventCollectionResult(intent: EventCollectionIntent, id?: string) {
  await readCollectionResult(intent, id);
  const payment = await readEventPayment(
    intent.scope,
    intent.preparation.eventId,
    intent.selection.personId,
    intent.preparation.id,
  );
  if (
    payment.debt_id !== intent.preparation.debtId ||
    payment.currency !== intent.selection.currency
  )
    throw new Error("EVENT_PAYMENT_UNAVAILABLE");
  return payment;
}
export { writeCollection, readCollectionReceipt };
