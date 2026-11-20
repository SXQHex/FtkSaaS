import { beforeEach, expect, it, vi } from "vitest";
import type {
  EventView,
  EventRegistrationView,
  EventRegistrationPaymentSummary,
} from "@ftksaas/api-contracts";
import { readDetailedEvent } from "./event-registration-read";
import {
  prepareRegisteredCollection,
  readRegisteredCollectionResult,
} from "./registered-event-collection";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const debt = {
  id: id(8),
  version: 2,
  preparation_id: null,
  currency: "TRY",
  amount_minor: "50000",
  net_minor: "50000",
  paid_minor: "10000",
  remaining_minor: "40000",
  credited_minor: "0",
  cancelled_minor: "0",
};
const initial: EventRegistrationView = {
  id: id(5),
  person_id: id(6),
  display_name: "Sentetik üye",
  state: "active",
  attendance_result: "unmarked",
  version: 3,
  payment_summary: {
    status: "available",
    amount_minor: "50000",
    currency: "TRY",
    net_minor: "50000",
    paid_minor: "10000",
    remaining_minor: "40000",
    credited_minor: "0",
    cancelled_minor: "0",
    debts: [debt],
  },
};
const source: EventView = {
  id: id(4),
  center_id: scope.centerId,
  name: "Etkinlik",
  timezone: "Europe/Istanbul",
  interval: { starts_at: "2026-11-20T15:00:00Z", ends_at: "2026-11-20T16:00:00Z" },
  state: "published",
  attendance_state: "open",
  venue: { kind: "external", name: "Salon", timezone: "Europe/Istanbul" },
  capacity: { kind: "unlimited" },
  terms: {
    fee_minor: "99000",
    currency: "USD",
    full_payment_required: false,
    allowed_product_version_ids: [],
    cancellation: { before_cutoff: "release", after_cutoff: "consume", no_show: "consume" },
    refund: { method: "none" },
  },
  discipline_ids: [],
  assignments: [],
  version: 1,
  registrations: [initial],
};
const draft = {
  choice: "now" as const,
  method: "bank_transfer" as const,
  amount: "20000",
  occurredAt: "2026-11-17T15:00",
  reference: "SENTETIK",
  note: "",
};
let event: EventView;
beforeEach(() => {
  call.mockReset();
  event = structuredClone(source);
  call.mockImplementation(async (op, r) => {
    if (op === "event_get_v1") return structuredClone(event);
    if (op === "management_state_get_v1")
      return {
        items: [
          {
            exists: true,
            entity: { type: "people", id: initial.person_id },
            current: {
              operation: "collection_record_v1",
              values: { person_id: initial.person_id },
            },
          },
        ],
        next_cursor: null,
      };
    if (op === "operation_status_get_v1")
      return {
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_reference: { type: "cash_movements", id: id(9) },
      };
    throw Error(`UNEXPECTED_API:${op}`);
  });
});
it("reads registration payment with the opt-in and keeps immutable fee independent from current event terms", async () => {
  const value = await readDetailedEvent(scope, source.id);
  expect(call.mock.calls[0]).toEqual([
    "event_get_v1",
    expect.objectContaining({
      event_id: source.id,
      include_payment_summary: true,
      center_id: scope.centerId,
    }),
  ]);
  expect(value.registrations![0]!.payment_summary).toMatchObject({
    amount_minor: "50000",
    currency: "TRY",
  });
  expect(value.terms).toMatchObject({ fee_minor: "99000", currency: "USD" });
});
it("constructs only a targeted collection against real unpaid debts and never prepares another debt", async () => {
  const intent = await prepareRegisteredCollection(
    scope,
    event.id,
    initial,
    event.timezone,
    draft,
    true,
  );
  expect(intent.request).toMatchObject({
    person_id: initial.person_id,
    currency: "TRY",
    amount_minor: "20000",
    debt_ids: [id(8)],
    payment: { method: "bank_transfer", reference: "SENTETIK" },
    occurred_at: "2026-11-17T12:00:00Z",
  });
  expect(
    call.mock.calls.every(([op]) => ["event_get_v1", "management_state_get_v1"].includes(op)),
  ).toBe(true);
  expect(intent.registration).toMatchObject({
    id: initial.id,
    amount: "50000",
    currency: "TRY",
    debtIds: [id(8)],
  });
});
it("requires explicit review before any source read", async () => {
  await expect(
    prepareRegisteredCollection(scope, event.id, initial, event.timezone, draft, false),
  ).rejects.toThrow("EVENT_REVIEW_REQUIRED");
  expect(call).not.toHaveBeenCalled();
});
it("rejects changed registration versions, debt versions and balances before collection", async () => {
  for (const mutate of [
    (r: EventRegistrationView) => {
      r.version++;
    },
    (r: EventRegistrationView) => {
      r.payment_summary!.debts[0]!.version++;
    },
    (r: EventRegistrationView) => {
      r.payment_summary!.remaining_minor = "30000";
    },
  ]) {
    event = structuredClone(source);
    mutate(event.registrations![0]!);
    await expect(
      prepareRegisteredCollection(scope, event.id, initial, event.timezone, draft, true),
    ).rejects.toThrow("EVENT_PAYMENT_SCOPE_CHANGED");
  }
});
it("rejects a foreign person or center and hidden or missing source without fallback", async () => {
  event.registrations![0]!.person_id = id(99);
  await expect(
    prepareRegisteredCollection(scope, event.id, initial, event.timezone, draft, true),
  ).rejects.toThrow();
  event = structuredClone(source);
  event.center_id = id(99);
  await expect(
    prepareRegisteredCollection(scope, event.id, initial, event.timezone, draft, true),
  ).rejects.toThrow("EVENT_SOURCE_UNAVAILABLE");
});
it("preserves available, no-cash, missing and restricted as four distinct native states", async () => {
  const empty = {
    amount_minor: null,
    currency: null,
    net_minor: null,
    paid_minor: null,
    remaining_minor: null,
    credited_minor: null,
    cancelled_minor: null,
    debts: [],
  };
  const variants: EventRegistrationPaymentSummary[] = [
    initial.payment_summary!,
    {
      ...empty,
      status: "no_cash_due",
      amount_minor: "0",
      currency: "TRY",
      net_minor: "0",
      paid_minor: "0",
      remaining_minor: "0",
      credited_minor: "0",
      cancelled_minor: "0",
    },
    { ...empty, status: "missing", amount_minor: "50000", currency: "TRY" },
    { ...empty, status: "restricted" },
  ];
  for (const payment of variants) {
    event.registrations![0]!.payment_summary = structuredClone(payment);
    expect((await readDetailedEvent(scope, event.id)).registrations![0]!.payment_summary).toEqual(
      payment,
    );
    if (payment.status !== "available")
      await expect(
        prepareRegisteredCollection(
          scope,
          event.id,
          event.registrations![0]!,
          event.timezone,
          draft,
          true,
        ),
      ).rejects.toThrow("EVENT_REGISTRATION_PAYMENT_UNAVAILABLE");
  }
});
it("refuses malformed known totals, duplicate debt IDs and cross-currency debts", async () => {
  for (const payment of [
    { ...initial.payment_summary!, remaining_minor: null },
    { ...initial.payment_summary!, debts: [debt, debt] },
    { ...initial.payment_summary!, debts: [{ ...debt, currency: "USD" }] },
  ]) {
    event.registrations![0]!.payment_summary = structuredClone(payment);
    await expect(readDetailedEvent(scope, event.id)).rejects.toThrow(
      "EVENT_REGISTRATION_PAYMENT_UNAVAILABLE",
    );
  }
});
it("confirms receipt identity and rereads live registration balances without a finance ledger grant", async () => {
  const intent = await prepareRegisteredCollection(
    scope,
    event.id,
    initial,
    event.timezone,
    draft,
    true,
  );
  event.registrations![0]!.payment_summary!.paid_minor = "30000";
  event.registrations![0]!.payment_summary!.remaining_minor = "20000";
  call.mockClear();
  expect((await readRegisteredCollectionResult(intent, id(9))).payment_summary).toMatchObject({
    remaining_minor: "20000",
  });
  expect(call.mock.calls.map(([op]) => op)).toEqual(["operation_status_get_v1", "event_get_v1"]);
});
it("does not acknowledge another collection's receipt or a pending operation", async () => {
  const intent = await prepareRegisteredCollection(
    scope,
    event.id,
    initial,
    event.timezone,
    draft,
    true,
  );
  call.mockResolvedValueOnce({
    operation: intent.operation,
    key: intent.request.operation_key,
    status: "succeeded",
    result_reference: { type: "cash_movements", id: id(99) },
  });
  await expect(readRegisteredCollectionResult(intent, id(9))).rejects.toThrow(
    "EVENT_COLLECTION_RECEIPT_UNAVAILABLE",
  );
  call.mockResolvedValueOnce({
    operation: intent.operation,
    key: intent.request.operation_key,
    status: "in_progress",
  });
  await expect(readRegisteredCollectionResult(intent, id(9))).rejects.toThrow(
    "EVENT_COLLECTION_RECEIPT_UNAVAILABLE",
  );
});
it("propagates source read failures after receipt acknowledgment instead of repeating a writer", async () => {
  const intent = await prepareRegisteredCollection(
    scope,
    event.id,
    initial,
    event.timezone,
    draft,
    true,
  );
  call
    .mockResolvedValueOnce({
      operation: intent.operation,
      key: intent.request.operation_key,
      status: "succeeded",
      result_reference: { type: "cash_movements", id: id(9) },
    })
    .mockRejectedValueOnce(Error("SERVICE_UNAVAILABLE"));
  await expect(readRegisteredCollectionResult(intent, id(9))).rejects.toThrow(
    "SERVICE_UNAVAILABLE",
  );
  expect(call.mock.calls.some(([op]) => op === "collection_record_v1")).toBe(false);
});
