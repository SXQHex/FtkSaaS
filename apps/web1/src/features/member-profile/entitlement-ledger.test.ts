import { beforeEach, expect, it, vi } from "vitest";
import type { EntitlementLedgerItem } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import { readEntitlementLedger } from "./entitlement-ledger";
import { readPerson } from "../people/people";
const scope = {
    accountId: "019a7b00-0000-7000-8000-000000000002",
    orgId: "019a7b00-0000-7000-8000-000000000003",
    centerId: "019a7b00-0000-7000-8000-000000000004",
  },
  person = "019a7b00-0000-7000-8000-000000000006",
  sale = "019a7b00-0000-7000-8000-000000000070";
const item: EntitlementLedgerItem = {
  id: scope.accountId,
  created_at: "2026-11-15T23:30:00Z",
  kind: "reserve",
  quantity: 1,
  balance_delta: 0,
  previous_id: null,
  source: { type: "reservations", id: scope.centerId },
};
const response = () => [
  {
    person_id: person,
    sale_id: sale,
    movements: {
      items: [structuredClone(item)],
      next_cursor: null as string | null,
      as_of: "2026-11-16T00:00:00Z",
    },
  },
];
beforeEach(() => {
  call.mockReset();
});
it("opts into canonical membership date and summary only for the requesting consumer", async () => {
  call.mockResolvedValue({ id: person, membership_started_at: "2026-11-13T22:00:00Z" });
  await readPerson(scope, person, { membershipDate: true, memberSummary: true });
  expect(call.mock.calls[0][1]).toMatchObject({
    include_membership_date: true,
    include_member_summary: true,
    person_id: person,
    center_id: scope.centerId,
  });
  await readPerson(scope, person);
  expect(call.mock.calls[1][1]).not.toHaveProperty("include_membership_date");
  call.mockResolvedValue({ id: person, membership_started_at: "not-a-date" });
  await expect(readPerson(scope, person, { membershipDate: true })).rejects.toThrow();
});
it("requests only the explicit native sale cursor and preserves hold quantity versus zero balance delta", async () => {
  call.mockResolvedValue(response());
  const page = await readEntitlementLedger(scope, person, sale, "native-cursor");
  expect(page.items[0]).toEqual(item);
  expect(call).toHaveBeenCalledWith(
    "entitlements_get_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: person,
      include_timed_rights: true,
      ledger_sale_id: sale,
      ledger_page: { limit: 20, sort: "created_at_asc", cursor: "native-cursor" },
    }),
  );
});
it("distinguishes absent projection from a successful empty native page and rejects another person", async () => {
  call.mockResolvedValue([{ person_id: person, sale_id: sale }]);
  await expect(readEntitlementLedger(scope, person, sale)).rejects.toThrow(
    "PROFILE_LEDGER_UNAVAILABLE",
  );
  const rows = response();
  rows[0].movements.items = [];
  call.mockResolvedValue(rows);
  expect((await readEntitlementLedger(scope, person, sale)).items).toEqual([]);
  rows[0].person_id = scope.accountId;
  await expect(readEntitlementLedger(scope, person, sale)).rejects.toThrow();
});
it("rejects duplicate movement IDs, repeated cursors and non-integer balance deltas", async () => {
  const rows = response();
  rows[0].movements.items.push({ ...item });
  call.mockResolvedValue(rows);
  await expect(readEntitlementLedger(scope, person, sale)).rejects.toThrow();
  rows[0].movements.items.pop();
  rows[0].movements.next_cursor = "same";
  await expect(readEntitlementLedger(scope, person, sale, "same")).rejects.toThrow();
  rows[0].movements.next_cursor = null;
  rows[0].movements.items[0].balance_delta = 0.5;
  await expect(readEntitlementLedger(scope, person, sale)).rejects.toThrow();
  rows[0].movements.items[0].balance_delta = 0;
  rows[0].movements.items[0].source.type = "accounts";
  await expect(readEntitlementLedger(scope, person, sale)).rejects.toThrow();
});
it("preserves native denial instead of manufacturing an empty ledger", async () => {
  const error = new BackendError({
    code: "FORBIDDEN",
    retryable: false,
    trace_id: scope.accountId,
  });
  call.mockRejectedValue(error);
  let failure: unknown;
  try {
    await readEntitlementLedger(scope, person, sale);
  } catch (caught) {
    failure = caught;
  }
  expect(failure).toBe(error);
  expect(failure).toBeInstanceOf(BackendError);
});
