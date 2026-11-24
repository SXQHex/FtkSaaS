import { beforeEach, expect, it, vi } from "vitest";
import type { EventView, EventPaymentPreparationView, Preview } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
import {
  prepareEventAction,
  previewEventCancellation,
  eventCancellationIntent,
  writeEventAction,
  readEventActionReceipt,
  readEventActionResult,
} from "./event-detail-command";
import {
  previewEventRegistration,
  eventRegistrationIntent,
  eventPreparationIntent,
  writeEventRegistration,
  writeEventPreparation,
  readRegistrationReceipt,
  readRegistrationResult,
  prepareEventCollection,
} from "./event-registration-command";
import { readDetailedEvent, readRegistrationPayment } from "./event-registration-read";
const mock = vi.hoisted(() => ({ call: vi.fn(), authority: vi.fn(), collection: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call: mock.call }) }));
vi.mock("../finance/finance", () => ({
  readCollectionAuthority: mock.authority,
  collectionIntent: mock.collection,
  financeDraft: () => ({}),
  writeCollection: vi.fn(),
  readCollectionReceipt: vi.fn(),
  readCollectionResult: vi.fn(),
}));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const initial: EventView = {
  id: id(4),
  center_id: scope.centerId,
  name: "Atölye",
  timezone: "Europe/Istanbul",
  interval: { starts_at: "2026-11-15T15:00:00Z", ends_at: "2026-11-15T16:00:00Z" },
  venue: { kind: "external", name: "Salon", timezone: "Europe/Istanbul" },
  terms: {
    fee_minor: "50000",
    currency: "TRY",
    full_payment_required: true,
    allowed_product_version_ids: [],
    cancellation: { before_cutoff: "release", after_cutoff: "consume", no_show: "consume" },
    refund: { method: "none" },
  },
  state: "published",
  capacity: { nominal: 10, maximum: 12 },
  attendance_state: "open",
  version: 3,
  discipline_ids: [],
  assignments: [],
  registrations: [
    {
      id: id(5),
      person_id: id(6),
      display_name: "Katılımcı",
      state: "active",
      attendance_result: "unmarked",
      version: 2,
    },
  ],
  duties: [
    {
      id: id(7),
      person_id: id(8),
      duty: "instructor",
      fee_minor: "20000",
      currency: "TRY",
      performed: null,
      version: 1,
      verified_at: null,
    },
  ],
  actual_started_at: "2026-11-15T15:00:30.123Z",
  actual_start_history: [],
};
const paymentInitial: EventPaymentPreparationView = {
  id: id(9),
  event_id: id(4),
  person_id: id(6),
  center_id: scope.centerId,
  debt_id: id(10),
  registration_id: null,
  state: "prepared",
  version: 1,
  amount_minor: "50000",
  currency: "TRY",
  paid_minor: "10000",
  remaining_minor: "40000",
  credited_minor: "0",
  student_credit_available_minor: "0",
  terms: initial.terms,
};
const target = { scope, eventId: id(4), personId: id(6), preparationId: id(9) };
let event: EventView, payment: EventPaymentPreparationView;
const preview = (): Preview => ({
  id: id(11),
  token: "synthetic-preview",
  scope_hash: "synthetic",
  expires_at: "2099-11-16T12:00:00Z",
  dependencies: {
    versions: [{ entity: { type: "events", id: event.id }, version: event.version }],
    policy_hashes: [],
    permission_hash: "synthetic",
  },
  effects: [],
  blockers: [],
});
beforeEach(() => {
  vi.clearAllMocks();
  event = structuredClone(initial);
  payment = structuredClone(paymentInitial);
  mock.call.mockImplementation(async (op, request) => {
    if (op === "event_get_v1") return structuredClone(event);
    if (op === "event_payment_get_v1") {
      if (
        request.selection &&
        (request.selection.registration_id ?? null) !== payment.registration_id
      )
        throw new BackendError({ code: "NOT_FOUND", retryable: false, trace_id: id(99) });
      return structuredClone(payment);
    }
    if (op === "management_state_get_v1") {
      const key = request.selector.key;
      const type = key.assignment_id
        ? "event_assignments"
        : key.registration_id
          ? "event_registrations"
          : key.person_id
            ? "event_payment_preparations"
            : "events";
      const entityId =
        key.assignment_id ?? key.registration_id ?? (key.person_id ? payment.id : event.id);
      return {
        items: [
          {
            operation: request.operation,
            exists: true,
            entity: { type, id: entityId },
            versions: [],
          },
        ],
        next_cursor: null,
      };
    }
    if (op === "event_cancel_preview_v1" || op === "event_registration_preview_v1")
      return preview();
    throw Error(`Unexpected operation ${op}`);
  });
});
it("requires explicit review and a fresh exact event before any writer", async () => {
  await expect(prepareEventAction(scope, event, { action: "publish" }, false)).rejects.toThrow(
    "EVENT_REVIEW_REQUIRED",
  );
  expect(mock.call).not.toHaveBeenCalled();
  const before = structuredClone(event);
  event.version++;
  await expect(
    prepareEventAction(scope, before, { action: "complete" }, true),
  ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  expect(mock.call.mock.calls.some(([op]) => op === "event_complete_v1")).toBe(false);
});
it("requires the original writer's native authority rather than treating a readable event as a grant", async () => {
  mock.call.mockResolvedValueOnce(event).mockResolvedValueOnce({ items: [], next_cursor: null });
  await expect(prepareEventAction(scope, event, { action: "publish" }, true)).rejects.toMatchObject(
    { code: "FORBIDDEN" },
  );
});
it("publishes with the native request and confirms an advanced published source", async () => {
  const intent = await prepareEventAction(scope, event, { action: "publish" }, true);
  expect(intent.request).not.toHaveProperty("expected_version");
  mock.call.mockResolvedValueOnce({ primary_id: event.id });
  await writeEventAction(intent);
  expect(mock.call).toHaveBeenLastCalledWith(
    "event_publish_v1",
    expect.objectContaining({
      event_id: event.id,
      published: true,
      operation_key: intent.request.operation_key,
    }),
  );
  await expect(readEventActionResult(intent, event.id)).rejects.toThrow("EVENT_RESULT_UNREAD");
  event.version++;
  await expect(readEventActionResult(intent, event.id)).resolves.toMatchObject({
    state: "published",
  });
});
it("keeps an unchanged subminute actual start exact and preserves audited clearing semantics", async () => {
  const corrected = await prepareEventAction(
    scope,
    event,
    { action: "correct_start", actual: "2026-11-15T18:00", offset: "", reason: "Kontrol" },
    true,
  );
  expect(corrected.request).toMatchObject({
    actual_started_at: initial.actual_started_at,
    expected_version: 3,
    reason: "Kontrol",
  });
  const cleared = await prepareEventAction(
    scope,
    event,
    { action: "clear_start", actual: "", offset: "", reason: "Hatalı kayıt" },
    true,
  );
  expect(cleared.request).toMatchObject({ actual_started_at: null });
  event.version++;
  event.actual_started_at = null;
  await expect(readEventActionResult(cleared, event.id)).resolves.toMatchObject({
    actual_started_at: null,
  });
});
it("rejects nonexistent and ambiguous wall times until an explicit valid UTC offset is selected", async () => {
  event.timezone = "America/New_York";
  await expect(
    prepareEventAction(
      scope,
      event,
      { action: "record_start", actual: "2026-03-08T02:30", offset: "", reason: "Başlangıç" },
      true,
    ),
  ).rejects.toThrow("SCHEDULE_TIME_GAP");
  await expect(
    prepareEventAction(
      scope,
      event,
      { action: "record_start", actual: "2026-11-01T01:30", offset: "", reason: "Başlangıç" },
      true,
    ),
  ).rejects.toThrow("SCHEDULE_TIME_AMBIGUOUS");
  const intent = await prepareEventAction(
    scope,
    event,
    { action: "record_start", actual: "2026-11-01T01:30", offset: "-05:00", reason: "Başlangıç" },
    true,
  );
  expect(intent.request).toMatchObject({ actual_started_at: "2026-11-01T06:30:00Z" });
});
it("marks one actual registration and requires explicit reason for an ineligible override", async () => {
  const intent = await prepareEventAction(
    scope,
    event,
    {
      action: "mark",
      id: id(5),
      result: "attended",
      reason: "Merkez onayı",
      recordIneligible: true,
    },
    true,
  );
  expect(intent.request).toMatchObject({
    registration_id: id(5),
    expected_version: 2,
    record_ineligible_attendance: true,
    reason: "Merkez onayı",
  });
  event.registrations![0]!.version++;
  event.registrations![0]!.attendance_result = "attended";
  await expect(readEventActionResult(intent, id(5))).rejects.toThrow("EVENT_RESULT_UNREAD");
  event.registrations![0]!.package_eligible_at_attendance = false;
  await expect(readEventActionResult(intent, id(5))).resolves.toBeTruthy();
  await expect(
    prepareEventAction(
      scope,
      event,
      { action: "mark", id: id(5), result: "attended", reason: "", recordIneligible: true },
      true,
    ),
  ).rejects.toThrow();
});
it("correction and participant cancellation pin the actual registration version", async () => {
  const before = structuredClone(event);
  event.registrations![0]!.version++;
  await expect(
    prepareEventAction(
      scope,
      before,
      {
        action: "correct_attendance",
        id: id(5),
        result: "no_show",
        reason: "Düzeltme",
        recordIneligible: false,
      },
      true,
    ),
  ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  const cancel = await prepareEventAction(
    scope,
    event,
    { action: "cancel_registration", id: id(5), reason: "Katılımcı isteği" },
    true,
  );
  expect(cancel.request).toMatchObject({ registration_id: id(5), expected_version: 3 });
  event.registrations![0]!.state = "cancelled";
  event.registrations![0]!.version++;
  await expect(readEventActionResult(cancel, id(5))).resolves.toBeTruthy();
});
it("closes attendance with event version and confirms completion separately", async () => {
  const close = await prepareEventAction(scope, event, { action: "close_attendance" }, true);
  expect(close.request).toMatchObject({ expected_version: 3 });
  event.version++;
  event.attendance_state = "closed";
  await expect(readEventActionResult(close, event.id)).resolves.toBeTruthy();
  const complete = await prepareEventAction(scope, event, { action: "complete" }, true);
  event.version++;
  event.state = "occurred";
  await expect(readEventActionResult(complete, event.id)).resolves.toBeTruthy();
});
it("requires reason to change a verified duty and confirms the actual assignment", async () => {
  event.duties![0]!.performed = true;
  event.duties![0]!.verified_at = "2026-11-15T17:00:00Z";
  await expect(
    prepareEventAction(
      scope,
      event,
      { action: "verify_duty", id: id(7), performed: false, reason: "" },
      true,
    ),
  ).rejects.toThrow();
  const intent = await prepareEventAction(
    scope,
    event,
    { action: "verify_duty", id: id(7), performed: false, reason: "Gerçek görev düzeltildi" },
    true,
  );
  event.duties![0]!.performed = false;
  event.duties![0]!.version++;
  await expect(readEventActionResult(intent, id(7))).resolves.toBeTruthy();
  await expect(readEventActionResult(intent, id(8))).rejects.toThrow("EVENT_RESULT_UNREAD");
});
it("keeps the cancellation preview bound to its exact event version and refuses blockers/expiry", async () => {
  const value = await previewEventCancellation(scope, event, "Merkez iptali");
  const intent = eventCancellationIntent(scope, event, value, true);
  expect(intent.operation).toBe("event_cancel_apply_v1");
  expect(intent.request).toMatchObject({ preview: { id: value.id, token: value.token } });
  expect(() =>
    eventCancellationIntent(scope, event, { ...value, expires_at: "2000-01-01T00:00:00Z" }, true),
  ).toThrow();
  expect(() => eventCancellationIntent(scope, { ...event, version: 99 }, value, true)).toThrow();
  event.version++;
  event.state = "cancelled";
  await expect(readEventActionResult(intent, event.id)).rejects.toThrow("EVENT_RESULT_UNREAD");
  event.registrations![0]!.state = "cancelled";
  await expect(readEventActionResult(intent, event.id)).resolves.toBeTruthy();
});
it("rejects mismatched operation, key and entity receipts", async () => {
  const intent = await prepareEventAction(scope, event, { action: "publish" }, true);
  mock.call.mockResolvedValueOnce({
    operation: intent.operation,
    key: "another",
    status: "succeeded",
    result_reference: { type: "events", id: event.id },
  });
  await expect(readEventActionReceipt(intent)).rejects.toThrow("EVENT_RECEIPT_UNAVAILABLE");
  mock.call.mockResolvedValueOnce({
    operation: intent.operation,
    key: intent.request.operation_key,
    status: "succeeded",
    result_reference: { type: "events", id: id(99) },
  });
  await expect(readEventActionReceipt(intent)).rejects.toThrow("EVENT_RECEIPT_UNAVAILABLE");
});
it("preserves absent participant and duty sources and rejects duplicate participant identities", async () => {
  event.registrations = undefined;
  event.duties = undefined;
  await expect(readDetailedEvent(scope, event.id)).resolves.toMatchObject({
    registrations: undefined,
    duties: undefined,
  });
  event.registrations = [initial.registrations![0]!, initial.registrations![0]!];
  await expect(readDetailedEvent(scope, event.id)).rejects.toThrow(
    "EVENT_REGISTRATIONS_UNAVAILABLE",
  );
});
it("freezes a registration target, rejects mixed package/payment sources, and requires an unexpired preview", async () => {
  const value = await previewEventRegistration(target),
    intent = eventRegistrationIntent(target, value, true);
  expect(intent.target).not.toBe(target);
  expect(() => eventRegistrationIntent({ ...target, eventId: id(99) }, value, true)).toThrow(
    "EVENT_REVIEW_REQUIRED",
  );
  expect(() => eventRegistrationIntent({ ...target, saleId: id(12) }, value, true)).toThrow(
    "EVENT_PAYMENT_SCOPE_CHANGED",
  );
  expect(() =>
    eventRegistrationIntent(target, { ...value, expires_at: "2000-01-01T00:00:00Z" }, true),
  ).toThrow();
  mock.call.mockResolvedValueOnce({ outcome: "registered", primary_id: id(5) });
  await expect(writeEventRegistration(intent)).resolves.toEqual({ primary_id: id(5) });
  payment.state = "registered";
  payment.registration_id = id(5);
  await expect(readRegistrationResult(intent, id(5))).resolves.toMatchObject({
    outcome: "registered",
  });
});
it("treats native capacity closure as a settled preparation outcome instead of inventing a registration", async () => {
  const intent = eventRegistrationIntent(target, preview(), true);
  mock.call.mockResolvedValueOnce({
    outcome: "capacity_closed",
    preparation_id: id(9),
    debt_id: id(10),
  });
  await expect(writeEventRegistration(intent)).resolves.toEqual({ primary_id: id(9) });
  payment.state = "capacity_closed";
  payment.remaining_minor = "0";
  payment.credited_minor = "10000";
  const result = await readRegistrationResult(intent, id(9));
  expect(result).toMatchObject({
    outcome: "capacity_closed",
    payment: { credited_minor: "10000", registration_id: null },
  });
  mock.call.mockResolvedValueOnce({
    operation: intent.operation,
    key: intent.request.operation_key,
    result_reference: { type: "event_payment_preparations", id: id(99) },
  });
  await expect(readRegistrationReceipt(intent)).rejects.toThrow("EVENT_RECEIPT_UNAVAILABLE");
});
it("uses only the real preparation ID and native typed payment view as its acknowledgment", async () => {
  const intent = eventPreparationIntent({ scope, eventId: id(4), personId: id(6) }, true);
  mock.call.mockResolvedValueOnce(payment);
  await expect(writeEventPreparation(intent)).resolves.toEqual({ primary_id: id(9) });
  mock.call.mockResolvedValueOnce({ ...payment, event_id: id(99) });
  await expect(writeEventPreparation(intent)).rejects.toThrow();
});
it("discovers an open event payment in one exact native read and rejects a mismatched result", async () => {
  await expect(readRegistrationPayment(scope, event.id, payment.person_id)).resolves.toEqual({
    kind: "available",
    value: payment,
  });
  expect(mock.call).toHaveBeenCalledExactlyOnceWith(
    "event_payment_get_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      selection: { event_id: event.id, person_id: payment.person_id },
    }),
  );
  mock.call.mockResolvedValueOnce({ ...payment, person_id: id(99) });
  await expect(readRegistrationPayment(scope, event.id, payment.person_id)).rejects.toThrow(
    "EVENT_PAYMENT_UNAVAILABLE",
  );
});
it("does not create a debt to discover payment and preserves restricted/absent reads", async () => {
  await expect(readRegistrationPayment(scope, event.id, id(6), id(5))).resolves.toMatchObject({
    kind: "unavailable",
  });
  expect(mock.call.mock.calls.some(([op]) => op === "event_payment_prepare_v1")).toBe(false);
  mock.call.mockRejectedValueOnce(
    new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: id(99) }),
  );
  await expect(readRegistrationPayment(scope, event.id, id(6), id(5))).resolves.toEqual({
    kind: "restricted",
  });
});
it("pins collection to the actual immutable event debt and refuses changed payment balances", async () => {
  mock.authority.mockResolvedValue(true);
  mock.collection.mockResolvedValue({
    scope,
    selection: { personId: id(6), currency: "TRY" },
    request: { amount_minor: "10000", debt_ids: [] },
  });
  const draft = {
    choice: "now" as const,
    amount: "10000",
    method: "cash" as const,
    occurredAt: "2026-11-16T15:00",
    reference: "",
    note: "",
  };
  const intent = await prepareEventCollection(scope, payment, "Europe/Istanbul", draft, true);
  expect(intent.request.debt_ids).toEqual([id(10)]);
  expect(intent.preparation).toEqual({ id: id(9), eventId: id(4), debtId: id(10) });
  const source = structuredClone(payment);
  payment.paid_minor = "20000";
  payment.remaining_minor = "30000";
  await expect(
    prepareEventCollection(scope, source, "Europe/Istanbul", draft, true),
  ).rejects.toThrow("EVENT_PAYMENT_SCOPE_CHANGED");
});
