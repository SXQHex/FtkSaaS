import { beforeEach, expect, it, vi } from "vitest";
import type { EventView } from "@ftksaas/api-contracts";
import { emptyEventDraft, type EventDraft } from "./event-draft";
import {
  eventDraft,
  eventSaveIntent,
  readEventReceipt,
  readEventResult,
  writeEventIntent,
} from "./event-command";
import { eventMonth, readEventsPage } from "./events-read";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const base: EventView = {
  id: id(4),
  center_id: scope.centerId,
  name: "Tango",
  interval: { starts_at: "2026-11-20T15:00:00Z", ends_at: "2026-11-20T16:00:00Z" },
  timezone: "Europe/Istanbul",
  venue: {
    kind: "external",
    name: "Public salon",
    address: "Açık adres",
    timezone: "Europe/Istanbul",
    latitude: 0,
    longitude: 0,
  },
  terms: {
    fee_minor: "45000",
    currency: "TRY",
    full_payment_required: true,
    allowed_product_version_ids: [],
    cancellation: { before_cutoff: "release", after_cutoff: "consume", no_show: "consume" },
    refund: { method: "none" },
  },
  capacity: { nominal: 10, maximum: 16 },
  assignments: [],
  assignment_terms: [],
  discipline_ids: [],
  version: 2,
  state: "draft",
  attendance_state: "open",
};
function draft(): EventDraft {
  return {
    ...emptyEventDraft,
    name: "Tango",
    starts: "2026-11-20T18:00",
    ends: "2026-11-20T19:00",
    timezone: "Europe/Istanbul",
    venueKind: "external",
    venueName: "Public salon",
    address: "Açık adres",
    nominal: "10",
    maximum: "16",
    fee: "45000",
    currency: "TRY",
    fullPayment: true,
    before: "release",
    after: "consume",
    noShow: "consume",
    refund: "none",
    reviewed: true,
  };
}
beforeEach(() => {
  call.mockReset();
  call.mockResolvedValue(structuredClone(base));
});
it("creates only a frozen draft with exact integer fees and no implied publication, sale or registration", async () => {
  const intent = await eventSaveIntent(scope, draft());
  expect(intent.request).toMatchObject({
    org_id: scope.orgId,
    center_id: scope.centerId,
    interval: base.interval,
    terms: base.terms,
    discipline_ids: [],
  });
  expect(call).not.toHaveBeenCalled();
  await writeEventIntent(intent);
  await writeEventIntent(intent);
  expect(
    call.mock.calls.every(
      ([op, req]) => op === "event_save_v1" && req.operation_key === intent.request.operation_key,
    ),
  ).toBe(true);
  expect(call.mock.calls[0]![1].request_id).not.toBe(call.mock.calls[1]![1].request_id);
});
it("requires explicit review and cancellation/refund selections without inventing policy defaults", async () => {
  await expect(eventSaveIntent(scope, { ...draft(), reviewed: false })).rejects.toThrow(
    "EVENT_REVIEW_REQUIRED",
  );
  await expect(eventSaveIntent(scope, { ...draft(), before: "" })).rejects.toThrow();
  await expect(eventSaveIntent(scope, { ...draft(), refund: "" })).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
});
it("supports external unlimited package practice while preserving native full-payment and zero-fee semantics", async () => {
  const intent = await eventSaveIntent(scope, {
    ...draft(),
    kind: "practice",
    fee: "0",
    unlimited: true,
    productIds: [id(8)],
  });
  expect(intent.request).toMatchObject({
    capacity: { kind: "unlimited" },
    terms: {
      package_usage: "eligibility_only",
      fee_minor: "0",
      full_payment_required: true,
      allowed_product_version_ids: [id(8)],
    },
  });
  await expect(
    eventSaveIntent(scope, { ...draft(), kind: "practice", fee: "0", productIds: [] }),
  ).rejects.toThrow();
  await expect(
    eventSaveIntent(scope, { ...draft(), venueKind: "internal", roomId: id(9), unlimited: true }),
  ).rejects.toThrow();
});
it("rejects invalid physical capacities, duplicate duties and fractional minor-unit amounts", async () => {
  await expect(eventSaveIntent(scope, { ...draft(), maximum: "9" })).rejects.toThrow();
  await expect(eventSaveIntent(scope, { ...draft(), fee: "12.5" })).rejects.toThrow();
  const duty = { personId: id(7), duty: "instructor" as const, fee: "1000", currency: "TRY" };
  await expect(eventSaveIntent(scope, { ...draft(), duties: [duty, duty] })).rejects.toThrow();
});
it("rejects the real DST gap and requires an explicit offset for each repeated wall time", async () => {
  await expect(
    eventSaveIntent(scope, {
      ...draft(),
      timezone: "America/New_York",
      starts: "2027-03-14T02:30",
      ends: "2027-03-14T04:00",
    }),
  ).rejects.toMatchObject({ message: "SCHEDULE_TIME_GAP" });
  const fold = {
    ...draft(),
    timezone: "America/New_York",
    starts: "2026-11-01T01:30",
    ends: "2026-11-01T01:15",
  };
  await expect(eventSaveIntent(scope, fold)).rejects.toMatchObject({
    message: "SCHEDULE_TIME_AMBIGUOUS",
  });
  const intent = await eventSaveIntent(scope, {
    ...fold,
    startOffset: "-04:00",
    endOffset: "-05:00",
  });
  expect(intent.request.interval).toEqual({
    starts_at: "2026-11-01T05:30:00Z",
    ends_at: "2026-11-01T06:15:00Z",
  });
});
it("preserves unchanged sub-minute native instants, venue coordinates and immutable assignment fees", async () => {
  const before = {
    ...base,
    interval: { starts_at: "2026-11-20T15:00:12.123456Z", ends_at: "2026-11-20T16:00:15.123456Z" },
    assignments: [{ person_id: id(7), duty: "instructor" as const }],
    assignment_terms: [
      {
        person_id: id(7),
        duty: "instructor" as const,
        fee_minor: "9007199254740993",
        currency: "TRY",
      },
    ],
  };
  call.mockResolvedValue(before);
  const value = await eventDraft(before);
  const intent = await eventSaveIntent(
    scope,
    { ...value, name: "Yeni başlık", reviewed: true },
    before,
  );
  expect(intent.request.interval).toEqual(before.interval);
  expect(intent.request.venue).toMatchObject({ latitude: 0, longitude: 0 });
  expect(intent.request.assignments).toEqual(before.assignment_terms);
  expect(intent.request.expected_version).toBe(2);
  await expect(eventDraft({ ...before, assignment_terms: undefined })).rejects.toThrow(
    "EVENT_DUTIES_UNAVAILABLE",
  );
});
it("preflights the exact live version before preparing an edit", async () => {
  call.mockResolvedValue({ ...base, version: 3 });
  await expect(eventSaveIntent(scope, draft(), base)).rejects.toMatchObject({
    code: "VERSION_CONFLICT",
  });
  expect(call.mock.calls.every(([op]) => op === "event_get_v1")).toBe(true);
});
it("binds receipt recovery to the same operation, key and entity", async () => {
  const intent = await eventSaveIntent(scope, draft());
  call.mockResolvedValue({
    operation: "event_save_v1",
    key: intent.request.operation_key,
    status: "succeeded",
    result_available: true,
    result_reference: { type: "people", id: base.id },
  });
  await expect(readEventReceipt(intent)).rejects.toThrow("EVENT_RECEIPT_UNAVAILABLE");
});
it("confirms exact native results without depending on JSON property order or replaying a writer", async () => {
  const intent = await eventSaveIntent(scope, draft());
  call.mockResolvedValue({ ...base, capacity: { maximum: 16, nominal: 10 } });
  expect((await readEventResult(intent, base.id)).id).toBe(base.id);
  expect(call.mock.calls.every(([op]) => op === "event_get_v1")).toBe(true);
  call.mockResolvedValue({ ...base, terms: { ...base.terms, fee_minor: "1" } });
  await expect(readEventResult(intent, base.id)).rejects.toThrow("EVENT_RESULT_UNREAD");
});
it("uses the actual center month boundary through DST and rejects repeated list cursors", async () => {
  expect((await eventMonth("America/New_York", "2026-11")).interval).toEqual({
    starts_at: "2026-11-01T04:00:00Z",
    ends_at: "2026-12-01T05:00:00Z",
  });
  call.mockResolvedValue({ items: [], next_cursor: "same", as_of: base.interval.starts_at });
  await expect(readEventsPage(scope, base.interval, "same")).rejects.toThrow(
    "EVENT_PAGE_UNAVAILABLE",
  );
});
