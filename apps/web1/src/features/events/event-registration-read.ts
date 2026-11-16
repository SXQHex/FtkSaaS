import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { EventPaymentPreparationView, EventView } from "../../lib/api-contracts/generated";
import { readEvent } from "./events-read";
const money = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((value) => BigInt(value) <= 9223372036854775807n);
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export async function readDetailedEvent(scope: ClientScope, id: string): Promise<EventView> {
  const event = await readEvent(scope, id);
  if (event.actual_started_at != null)
    z.iso.datetime({ offset: true }).parse(event.actual_started_at);
  if (event.registrations !== undefined) {
    const rows = z
      .array(
        z.object({
          id: z.uuid(),
          person_id: z.uuid(),
          display_name: z.string(),
          state: z.enum(["active", "cancelled", "completed"]),
          attendance_result: z.enum(["unmarked", "attended", "no_show", "blocked"]),
          version: z.number().int().positive().safe(),
          package_eligible: z.boolean().nullish(),
          package_eligible_at_attendance: z.boolean().nullish(),
        }),
      )
      .parse(event.registrations);
    if (new Set(rows.map((row) => row.id)).size !== rows.length)
      throw new Error("EVENT_REGISTRATIONS_UNAVAILABLE");
  }
  if (event.duties !== undefined) {
    const rows = z
      .array(
        z.object({
          id: z.uuid(),
          person_id: z.uuid(),
          duty: z.enum(["instructor", "assistant"]),
          fee_minor: money,
          currency: z.string().regex(/^[A-Z]{3}$/),
          performed: z.boolean().nullable(),
          version: z.number().int().positive().safe(),
          verified_at: z.iso.datetime({ offset: true }).nullable(),
        }),
      )
      .parse(event.duties);
    if (new Set(rows.map((row) => row.id)).size !== rows.length)
      throw new Error("EVENT_DUTIES_UNAVAILABLE");
  }
  return event;
}
export function validateEventPayment(
  value: EventPaymentPreparationView,
  scope: ClientScope,
  eventId: string,
  personId: string,
  id?: string,
) {
  z.object({
    id: z.uuid(),
    event_id: z.uuid(),
    person_id: z.uuid(),
    center_id: z.uuid(),
    debt_id: z.uuid(),
    registration_id: z.uuid().nullable(),
    state: z.enum(["prepared", "registered", "capacity_closed", "event_cancelled"]),
    version: z.number().int().positive().safe(),
    amount_minor: money,
    currency: z.string().regex(/^[A-Z]{3}$/),
    paid_minor: money,
    remaining_minor: money,
    credited_minor: money,
    student_credit_available_minor: money,
  }).parse(value);
  if (
    value.center_id !== scope.centerId ||
    value.event_id !== eventId ||
    value.person_id !== personId ||
    (id && value.id !== id)
  )
    throw new Error("EVENT_PAYMENT_UNAVAILABLE");
  money.parse(value.terms.fee_minor);
  if (value.terms.currency !== value.currency) throw new Error("EVENT_PAYMENT_UNAVAILABLE");
  return value;
}
export async function readEventPayment(
  scope: ClientScope,
  eventId: string,
  personId: string,
  id: string,
) {
  const backend = await scopedBackend(scope);
  return validateEventPayment(
    await backend.call("event_payment_get_v1", {
      ...common(scope),
      request_id: uuidv7(),
      preparation_id: z.uuid().parse(id),
    }),
    scope,
    eventId,
    personId,
    id,
  );
}
export type RegistrationPayment =
  | { kind: "available"; value: EventPaymentPreparationView }
  | { kind: "unavailable" | "restricted" };
export async function readRegistrationPayment(
  scope: ClientScope,
  eventId: string,
  personId: string,
  registrationId?: string,
): Promise<RegistrationPayment> {
  const backend = await scopedBackend(scope);
  try {
    const page = await backend.call("management_state_get_v1", {
      ...common(scope),
      request_id: uuidv7(),
      operation: "event_payment_prepare_v1",
      selector: {
        operation: "event_payment_prepare_v1",
        key: { event_id: eventId, person_id: personId },
      },
      page: { limit: 20 },
    });
    const ids = new Set<string>();
    for (const row of page.items) {
      if (row.operation !== "event_payment_prepare_v1")
        throw new Error("EVENT_PAYMENT_UNAVAILABLE");
      if (!row.exists) continue;
      if (row.entity?.type !== "event_payment_preparations" || ids.has(row.entity.id))
        throw new Error("EVENT_PAYMENT_UNAVAILABLE");
      ids.add(z.uuid().parse(row.entity.id));
      const value = validateEventPayment(
        await backend.call("event_payment_get_v1", {
          ...common(scope),
          request_id: uuidv7(),
          preparation_id: row.entity.id,
        }),
        scope,
        eventId,
        personId,
        row.entity.id,
      );
      if (registrationId ? value.registration_id === registrationId : value.state === "prepared")
        return { kind: "available", value };
    }
    // An absent, hidden or older cursor result is not evidence of a zero debt or a free registration.
    return { kind: "unavailable" };
  } catch (error) {
    if (error instanceof BackendError && ["FORBIDDEN", "NOT_FOUND"].includes(error.code))
      return { kind: "restricted" };
    throw error;
  }
}
