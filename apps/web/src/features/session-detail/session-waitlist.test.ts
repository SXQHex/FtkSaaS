import { beforeEach, expect, it, vi } from "vitest";
import type { WaitlistEntryView, SeatOfferView } from "@ftksaas/api-contracts";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  waitlistIntent,
  writeWaitlist,
  readWaitlistReceipt,
  readWaitlistResult,
} from "./session-waitlist";
import { readOverviewParticipants } from "../overview/overview-read";
import { readSessionWaitlist, readSessionParticipants } from "./session-detail-read";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) },
  sid = id(4),
  person = id(5);
const entry: WaitlistEntryView = {
  id: id(6),
  person_id: person,
  center_id: scope.centerId,
  session_id: sid,
  version: 3,
  created_at: "2026-11-16T10:00:00Z",
  joined_at: "2026-11-16T10:01:00Z",
  state: "offered",
  offers: [],
};
const offer: SeatOfferView = {
  id: id(7),
  entry_id: entry.id,
  session_id: sid,
  person_id: person,
  version: 4,
  state: "active",
  created_at: entry.created_at,
  expires_at: "2099-01-01T00:00:00Z",
};
const asOf = "2026-11-16T12:00:00Z";
beforeEach(() => {
  call.mockReset();
});
it("a manager cannot construct another person's offer decision, and an expired offer is not accepted", () => {
  expect(() =>
    waitlistIntent(scope, sid, person, "accept", undefined, entry, offer, id(8), asOf),
  ).toThrow("SOURCE_UNAVAILABLE");
  expect(() =>
    waitlistIntent(
      scope,
      sid,
      person,
      "accept",
      undefined,
      entry,
      { ...offer, expires_at: "2020-01-01T00:00:00Z" },
      person,
      asOf,
    ),
  ).toThrow("SOURCE_UNAVAILABLE");
});
it("the same frozen intent preserves operation key, offer ID and version on retransmission", async () => {
  const intent = waitlistIntent(
    scope,
    sid,
    person,
    "reject",
    undefined,
    entry,
    offer,
    person,
    asOf,
  );
  call.mockResolvedValue({ primary_id: offer.id });
  await writeWaitlist(intent);
  await writeWaitlist(intent);
  expect(
    call.mock.calls.map(([operation, req]) => [
      operation,
      req.operation_key,
      req.offer_id,
      req.expected_version,
    ]),
  ).toEqual(Array(2).fill(["seat_offer_reject_v1", intent.key, offer.id, 4]));
});
it("an accepted offer receipt cannot be mistaken for a reservation receipt", async () => {
  const intent = waitlistIntent(
    scope,
    sid,
    person,
    "accept",
    undefined,
    entry,
    offer,
    person,
    asOf,
  );
  call.mockResolvedValue({
    operation: intent.operation,
    key: intent.key,
    status: "succeeded",
    result_reference: { type: "reservations", id: id(9) },
  });
  await expect(readWaitlistReceipt(intent)).rejects.toThrow("RECEIPT_UNAVAILABLE");
});
it("a terminal reject is confirmed from the original entry and offer, not a different latest offer", async () => {
  const intent = waitlistIntent(
    scope,
    sid,
    person,
    "reject",
    undefined,
    entry,
    offer,
    person,
    asOf,
  );
  call.mockResolvedValue({
    items: [
      {
        operation: "waitlist_join_v1",
        entity: { type: "waitlist_entries", id: entry.id },
        exists: true,
        state: "closed",
        versions: [{ entity: { type: "waitlist_entries", id: entry.id }, version: 4 }],
        waitlist_detail: {
          ...entry,
          state: "closed",
          version: 4,
          offers: [{ ...offer, state: "rejected", version: 5 }],
        },
      },
    ],
    next_cursor: null,
  });
  await expect(readWaitlistResult(intent, offer.id)).resolves.toMatchObject({
    id: entry.id,
    state: "closed",
  });
  await expect(readWaitlistResult(intent, id(9))).rejects.toThrow("RESULT_UNAVAILABLE");
});
it("session discovery uses separate server cursors and rejects an unrelated source row", async () => {
  call.mockResolvedValue({ items: [], next_cursor: "next", as_of: asOf });
  await readSessionWaitlist(scope, sid, "offers", "previous");
  expect(call).toHaveBeenCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      selector: {
        operation: "waitlist_join_v1",
        key: { directory: "session", session_id: sid, view: "offers" },
      },
      page: { limit: 20, sort: "created_at_asc", cursor: "previous" },
    }),
  );
  call.mockResolvedValue({
    items: [
      {
        operation: "waitlist_join_v1",
        exists: true,
        entity: { type: "waitlist_entries", id: entry.id },
        state: entry.state,
        versions: [{ entity: { type: "waitlist_entries", id: entry.id }, version: entry.version }],
        waitlist_display_name: "Sentetik kişi",
        waitlist_detail: { ...entry, session_id: id(11) },
      },
    ],
    next_cursor: null,
  });
  await expect(readSessionWaitlist(scope, sid, "entries")).rejects.toThrow("WAITLIST_UNAVAILABLE");
});
it("the participant page opts into its assigned source without querying unrelated entitlements", async () => {
  call.mockResolvedValue({ items: [], next_cursor: null, as_of: entry.created_at });
  await readSessionParticipants(scope, sid);
  expect(call).toHaveBeenCalledTimes(1);
  expect(call).toHaveBeenCalledWith(
    "reservation_list_v1",
    expect.objectContaining({ session_id: sid, include_source_summary: true }),
  );
});

it("hydrates people only for the first three eligible overview reservations", async () => {
  const rows = ["cancelled", "active", "completed", "active", "active"].map((state, index) => ({
    id: id(20 + index),
    session_id: sid,
    person_id: id(40 + index),
    mode: "flexible",
    state,
    version: 1,
  }));
  call.mockImplementation((operation: string, request: { person_id: string }) =>
    Promise.resolve(
      operation === "reservation_list_v1"
        ? { items: rows, next_cursor: "unneeded", as_of: entry.created_at }
        : { id: request.person_id, display_name: "Sentetik üye" },
    ),
  );
  const preview = await readOverviewParticipants(scope, sid);
  expect(preview.map(({ reservation }) => reservation.id)).toEqual(
    rows.slice(1, 4).map((row) => row.id),
  );
  expect(
    call.mock.calls
      .filter(([operation]) => operation === "person_get_v1")
      .map(([, request]) => request.person_id),
  ).toEqual(rows.slice(1, 4).map((row) => row.person_id));
  expect(call).toHaveBeenCalledTimes(4);
});
