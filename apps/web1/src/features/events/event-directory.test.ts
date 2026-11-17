import { beforeEach, expect, it, vi } from "vitest";
import { readEventsPage } from "./events-read";
import type { EventView, EventDirectorySummary } from "../../lib/api-contracts/generated";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const interval = { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" };
const event: EventView = {
  id: id(4),
  center_id: scope.centerId,
  name: "Tango",
  timezone: "Europe/Istanbul",
  interval: { starts_at: "2026-11-20T15:00:00Z", ends_at: "2026-11-20T16:00:00Z" },
  state: "published",
  attendance_state: "open",
  venue: { kind: "external", name: "Salon", timezone: "Europe/Istanbul" },
  capacity: { kind: "unlimited" },
  terms: {
    fee_minor: "45000",
    currency: "TRY",
    full_payment_required: false,
    allowed_product_version_ids: [],
    cancellation: { before_cutoff: "release", after_cutoff: "consume", no_show: "consume" },
    refund: { method: "none" },
  },
  discipline_ids: [],
  assignments: [],
  version: 1,
  active_registration_count: 4,
};
const summary: EventDirectorySummary = {
  published: 11,
  draft: 7,
  occurred: 2,
  cancelled: 1,
  published_active_registrations: 44,
  unresolved_payment_registrations: 1,
  pending_payments: [
    { currency: "TRY", remaining_minor: "900719925474099300", registration_count: 2 },
    { currency: "USD", remaining_minor: "20000", registration_count: 1 },
  ],
};
beforeEach(() => call.mockReset());
it("sends server-side trimmed query, native state, summary opt-in and exact cursor scope", async () => {
  call.mockResolvedValueOnce({
    items: [event],
    next_cursor: "next",
    as_of: interval.starts_at,
    summary,
  });
  const page = await readEventsPage(scope, interval, "current", {
    query: "  Tango %_  ",
    status: "published",
    includeSummary: true,
  });
  expect(call).toHaveBeenCalledExactlyOnceWith(
    "event_list_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      interval,
      query: "Tango %_",
      status: "published",
      include_summary: true,
      page: { limit: 20, sort: "starts_at_asc", cursor: "current" },
    }),
  );
  expect(page.summary).toEqual(summary);
  expect(page.summary!.published).toBe(11);
  expect(page.items).toHaveLength(1);
  expect(page.items[0]!.active_registration_count).toBe(4);
});
it("retains old basic calls and never sends blank search or a summary grant implicitly", async () => {
  call.mockResolvedValue({ items: [], next_cursor: null, as_of: interval.starts_at });
  await readEventsPage(scope, interval, undefined, { query: "   ", status: "all" });
  expect(call.mock.calls[0]![1]).not.toHaveProperty("query");
  expect(call.mock.calls[0]![1]).not.toHaveProperty("include_summary");
  await readEventsPage(scope, interval);
  expect(call.mock.calls[1]![1]).not.toHaveProperty("status");
});
it("rejects missing or malformed native totals instead of counting the cursor page", async () => {
  for (const malformed of [
    undefined,
    { ...summary, published: -1 },
    {
      ...summary,
      pending_payments: [{ currency: "TRY", remaining_minor: 900, registration_count: 2 }],
    },
  ]) {
    call.mockResolvedValueOnce({
      items: [event],
      next_cursor: null,
      as_of: interval.starts_at,
      summary: malformed,
    });
    await expect(
      readEventsPage(scope, interval, undefined, { includeSummary: true }),
    ).rejects.toThrow();
  }
});
it("rejects duplicate currencies and missing native registration counts", async () => {
  call.mockResolvedValueOnce({
    items: [event],
    next_cursor: null,
    as_of: interval.starts_at,
    summary: {
      ...summary,
      pending_payments: [summary.pending_payments[0], summary.pending_payments[0]],
    },
  });
  await expect(
    readEventsPage(scope, interval, undefined, { includeSummary: true }),
  ).rejects.toThrow("EVENT_SUMMARY_UNAVAILABLE");
  call.mockResolvedValueOnce({
    items: [{ ...event, active_registration_count: undefined }],
    next_cursor: null,
    as_of: interval.starts_at,
    summary,
  });
  await expect(
    readEventsPage(scope, interval, undefined, { includeSummary: true }),
  ).rejects.toThrow();
});
it("does not turn list rejection into an empty directory or zero summary", async () => {
  const denied = new Error("FORBIDDEN");
  call.mockRejectedValueOnce(denied);
  await expect(readEventsPage(scope, interval, undefined, { includeSummary: true })).rejects.toBe(
    denied,
  );
});
