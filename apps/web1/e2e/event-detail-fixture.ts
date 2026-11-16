import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { EventPaymentPreparationView } from "../src/lib/api-contracts/generated.js";
import { mockEvents, eventId } from "./events-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
export const detailIds = {
  registration: "019ab7b0-0000-7000-8000-000000000094",
  preparation: "019ab7b0-0000-7000-8000-000000000095",
  debt: "019ab7b0-0000-7000-8000-000000000096",
  preview: "019ab7b0-0000-7000-8000-000000000097",
  cash: "019ab7b0-0000-7000-8000-000000000098",
};
export async function mockEventDetail(
  page: Page,
  mode: "normal" | "unknown" | "unread" | "denied" | "capacity" = "normal",
) {
  const base = await mockEvents(page),
    event = base.events[0]!;
  event.state = "published";
  event.registrations = [];
  event.duties = [];
  event.actual_start_history = [];
  event.interval = { starts_at: "2026-11-15T15:00:00Z", ends_at: "2026-11-15T16:00:00Z" };
  event.terms.full_payment_required = true;
  const state = {
    event,
    payment: undefined as EventPaymentPreparationView | undefined,
    writes: [] as { op: string; request: Record<string, unknown> }[],
    effects: 0,
    failRead: false,
    unknownSent: false,
    receipts: new Map<string, { type: string; id: string }>(),
    cash: undefined as Record<string, unknown> | undefined,
  };
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const reject = (code: string, retryable = false) =>
      route.fulfill({
        status: retryable ? 503 : 403,
        json: { ok: false, error: { code, retryable, trace_id: I.role } },
      });
    if (
      op.startsWith("event_") ||
      (op === "management_state_get_v1" && String(r.operation).startsWith("event_"))
    ) {
      expect(r.org_id).toBe(I.org);
      expect(r.center_id).toBe(I.center);
    }
    if (op === "event_get_v1") {
      if (state.failRead) {
        state.failRead = false;
        return reject("SERVICE_UNAVAILABLE", true);
      }
      return send(event);
    }
    if (op === "entitlements_get_v1") return send([]);
    if (op === "management_state_get_v1" && r.operation === "collection_record_v1")
      return send({
        items: [
          {
            operation: r.operation,
            exists: true,
            entity: { type: "people", id: r.selector.key.person_id },
            versions: [],
            current: { operation: r.operation, values: { person_id: r.selector.key.person_id } },
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    if (op === "management_state_get_v1" && String(r.operation).startsWith("event_")) {
      if (mode === "denied") return reject("FORBIDDEN");
      const key = r.selector.key;
      if (r.operation === "event_payment_prepare_v1")
        return send({
          items: state.payment
            ? [
                {
                  operation: r.operation,
                  exists: true,
                  entity: { type: "event_payment_preparations", id: state.payment.id },
                  versions: [],
                },
              ]
            : [],
          next_cursor: null,
          as_of: new Date().toISOString(),
        });
      return send({
        items: [
          {
            operation: r.operation,
            exists: true,
            entity: key.registration_id
              ? { type: "event_registrations", id: key.registration_id }
              : key.assignment_id
                ? { type: "event_assignments", id: key.assignment_id }
                : { type: "events", id: eventId },
            versions: [],
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (op === "event_cancel_preview_v1" || op === "event_registration_preview_v1") {
      return send({
        id: detailIds.preview,
        token: "synthetic-native-preview",
        scope_hash: "synthetic",
        dependencies: {
          versions: [{ entity: { type: "events", id: eventId }, version: event.version }],
          policy_hashes: [],
          permission_hash: "synthetic",
        },
        effects:
          op === "event_cancel_preview_v1"
            ? [{ entity: { type: "events", id: eventId }, action: "cancel" }]
            : [],
        blockers: [],
        expires_at: "2099-11-16T12:00:00Z",
      });
    }
    if (op === "event_payment_get_v1")
      return state.payment ? send(state.payment) : reject("NOT_FOUND");
    if (op === "finance_get_v1" && state.cash)
      return send({
        person_id: r.person_id,
        currency: "TRY",
        credit_available_minor: "0",
        debts: [],
        movements: { items: [state.cash], next_cursor: null, as_of: new Date().toISOString() },
      });
    if (op === "operation_status_get_v1" && state.receipts.has(r.key))
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: state.receipts.get(r.key),
      });
    if (
      op === "collection_record_v1" ||
      [
        "event_publish_v1",
        "event_complete_v1",
        "event_cancel_apply_v1",
        "event_registration_cancel_v1",
        "event_attendance_mark_v1",
        "event_attendance_correct_v1",
        "event_attendance_close_v1",
        "event_actual_start_record_v1",
        "event_actual_start_correct_v1",
        "event_duty_verify_v1",
        "event_register_v1",
        "event_payment_prepare_v1",
      ].includes(op)
    ) {
      state.writes.push({ op, request: r });
      if (mode === "denied") return reject("FORBIDDEN");
      let primary = state.receipts.get(r.operation_key);
      if (!primary) {
        state.effects++;
        event.version++;
        primary = { type: "events", id: eventId };
        if (op === "event_publish_v1") event.state = "published";
        if (op === "event_complete_v1") event.state = "occurred";
        if (op === "event_cancel_apply_v1") {
          event.state = "cancelled";
          event.registrations!.forEach((row) => {
            row.state = "cancelled";
            row.version++;
          });
        }
        if (op === "event_actual_start_record_v1" || op === "event_actual_start_correct_v1")
          event.actual_started_at = r.actual_started_at;
        if (op === "event_attendance_close_v1") {
          event.attendance_state = "closed";
          event.registrations!.forEach((row) => {
            row.state = "completed";
            row.version++;
          });
        }
        if (
          op === "event_attendance_mark_v1" ||
          op === "event_attendance_correct_v1" ||
          op === "event_registration_cancel_v1"
        ) {
          const row = event.registrations!.find((entry) => entry.id === r.registration_id)!;
          row.version++;
          if (op === "event_registration_cancel_v1") row.state = "cancelled";
          else row.attendance_result = r.result;
          primary = { type: "event_registrations", id: row.id };
        }
        if (op === "event_duty_verify_v1") {
          const row = event.duties!.find((entry) => entry.id === r.assignment_id)!;
          row.performed = r.performed;
          row.version++;
          row.verified_at = new Date().toISOString();
          primary = { type: "event_assignments", id: row.id };
        }
        if (op === "event_payment_prepare_v1") {
          state.payment = {
            id: detailIds.preparation,
            event_id: eventId,
            person_id: r.person_id,
            center_id: I.center,
            debt_id: detailIds.debt,
            registration_id: null,
            state: "prepared",
            version: 1,
            amount_minor: event.terms.fee_minor,
            currency: "TRY",
            paid_minor: "0",
            remaining_minor: event.terms.fee_minor,
            credited_minor: "0",
            student_credit_available_minor: "0",
            terms: structuredClone(event.terms),
          };
          primary = { type: "event_payment_preparations", id: detailIds.preparation };
        }
        if (op === "collection_record_v1") {
          expect(r.debt_ids).toEqual([detailIds.debt]);
          state.payment!.paid_minor = r.amount_minor;
          state.payment!.remaining_minor = "0";
          state.cash = {
            id: detailIds.cash,
            kind: "collection",
            amount_minor: r.amount_minor,
            currency: r.currency,
            occurred_at: r.occurred_at,
            previous_id: null,
            center_id: I.center,
            payment: r.payment,
          };
          primary = { type: "cash_movements", id: detailIds.cash };
        }
        if (op === "event_register_v1") {
          if (mode === "capacity") {
            state.payment!.state = "capacity_closed";
            state.payment!.remaining_minor = "0";
            state.payment!.credited_minor = state.payment!.paid_minor;
            primary = { type: "event_payment_preparations", id: detailIds.preparation };
          } else {
            event.registrations!.push({
              id: detailIds.registration,
              person_id: r.person_id,
              display_name: "Örnek Eğitmen",
              state: "active",
              attendance_result: "unmarked",
              version: 1,
            });
            if (state.payment) {
              state.payment.state = "registered";
              state.payment.registration_id = detailIds.registration;
            }
            primary = { type: "event_registrations", id: detailIds.registration };
          }
        }
        state.receipts.set(r.operation_key, primary);
        if (mode === "unknown" && !state.unknownSent) {
          state.unknownSent = true;
          return route.abort("failed");
        }
        if (mode === "unread") state.failRead = true;
      }
      if (op === "event_payment_prepare_v1") return send(state.payment);
      if (op === "event_register_v1" && mode === "capacity")
        return send({
          outcome: "capacity_closed",
          operation_id: I.role,
          preparation_id: detailIds.preparation,
          debt_id: detailIds.debt,
          version: state.payment!.version,
          replayed: false,
          remaining_removed_minor: "0",
          student_credit_added_minor: state.payment!.credited_minor,
          currency: "TRY",
        });
      return send({
        ...(op === "event_register_v1" ? { outcome: "registered" } : {}),
        operation_id: I.role,
        primary_id: primary.id,
        version: event.version,
        replayed: false,
        related: [],
      });
    }
    return route.fallback();
  });
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/events/${eventId}`);
  await expect(page.getByRole("heading", { name: event.name, exact: true })).toBeVisible();
  return state;
}
