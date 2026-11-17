import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call: mock.call }) }));
import { instructorEarningMonths, readInstructorEarningPage } from "./instructor-earnings-read";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const interval = { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" };
const row = {
  id: id(5),
  person_id: id(4),
  center_id: scope.centerId,
  amount_minor: "9007199254740993",
  paid_minor: "1",
  remaining_minor: "9007199254740992",
  currency: "TRY",
  direction: "add",
  created_at: "2026-11-16T12:00:00Z",
  session_id: id(6),
  event_assignment_id: null,
  previous_id: null,
  closure_id: null,
  version: 1,
  basis: { source: "agreement_fixed", currency: "TRY", quantity: 1, excluded_blocked: 0 },
};
beforeEach(() => vi.clearAllMocks());
it("models month-only periods in the center IANA zone across DST and year rollover", async () => {
  const months = await instructorEarningMonths("America/New_York", "2027-12-01T03:00:00Z");
  expect(months.map((r) => r.id)).toEqual(["2027-11", "2027-10"]);
  expect(months[0]!.interval).toEqual({
    starts_at: "2027-11-01T04:00:00Z",
    ends_at: "2027-12-01T05:00:00Z",
  });
  expect((await instructorEarningMonths("Europe/Istanbul", "2027-01-15T12:00:00Z"))[1]!.id).toBe(
    "2026-12",
  );
});
const earningPage = {
  view: "earnings",
  items: [row],
  next_cursor: "next",
  as_of: "2026-11-16T12:00:00Z",
  totals: [],
};
it("keeps one cursor page, exact money strings and native self scope", async () => {
  mock.call.mockResolvedValue(earningPage);
  expect(await readInstructorEarningPage(scope, id(4), interval, "current")).toEqual(earningPage);
  expect(mock.call).toHaveBeenCalledExactlyOnceWith(
    "instructor_account_get_v1",
    expect.objectContaining({
      person_id: id(4),
      center_id: scope.centerId,
      view: "earnings",
      interval,
      page: { limit: 20, cursor: "current" },
    }),
  );
});
it("rejects wrong centers, malformed identities, currency mismatches and invalid money", async () => {
  for (const change of [
    { person_id: "invalid" },
    { center_id: id(9) },
    { paid_minor: "NaN" },
    { amount_minor: "1.5" },
    { created_at: interval.ends_at },
    { basis: { ...row.basis, currency: "USD" } },
  ]) {
    mock.call.mockResolvedValue({ ...earningPage, items: [{ ...row, ...change }] });
    await expect(readInstructorEarningPage(scope, id(4), interval)).rejects.toThrow(
      "INSTRUCTOR_EARNINGS_UNAVAILABLE",
    );
  }
});
it("rejects duplicate identities and a repeated native cursor", async () => {
  mock.call
    .mockResolvedValueOnce({ ...earningPage, items: [row, row], next_cursor: null })
    .mockResolvedValueOnce({ ...earningPage, next_cursor: "same" });
  await expect(readInstructorEarningPage(scope, id(4), interval)).rejects.toThrow(
    "INSTRUCTOR_EARNINGS_UNAVAILABLE",
  );
  await expect(readInstructorEarningPage(scope, id(4), interval, "same")).rejects.toThrow(
    "INSTRUCTOR_EARNINGS_UNAVAILABLE",
  );
});
it("omits interval for all-period earnings and preserves an authorized immutable historical alias", async () => {
  const old = { ...row, person_id: id(99), created_at: "2019-01-01T00:00:00Z" };
  mock.call.mockResolvedValue({ ...earningPage, items: [old] });
  expect((await readInstructorEarningPage(scope, id(4), undefined, "all-next")).items).toEqual([
    old,
  ]);
  const request = mock.call.mock.calls[0]![1];
  expect(request).toMatchObject({
    person_id: id(4),
    view: "earnings",
    page: { limit: 20, cursor: "all-next" },
  });
  expect(request).not.toHaveProperty("interval");
});
it.each(["payments", "agreements"])(
  "rejects the wrong native %s view rather than presenting it as an empty ledger",
  async (view) => {
    mock.call.mockResolvedValue({ ...earningPage, view, items: [] });
    await expect(readInstructorEarningPage(scope, id(4))).rejects.toThrow(
      "INSTRUCTOR_EARNINGS_UNAVAILABLE",
    );
  },
);
it("rejects a reversed interval before sending a native read", async () => {
  await expect(
    readInstructorEarningPage(scope, id(4), {
      starts_at: interval.ends_at,
      ends_at: interval.starts_at,
    }),
  ).rejects.toThrow("INSTRUCTOR_EARNINGS_UNAVAILABLE");
  expect(mock.call).not.toHaveBeenCalled();
});

import { readInstructorAccount } from "./instructor-earnings-read";
const totals = [
  {
    currency: "TRY",
    earned_minor: "9007199254740993",
    paid_minor: "-500",
    remaining_minor: "700",
    overpaid_minor: "0",
  },
];
const ledger = {
  id: id(11),
  root_payment_id: id(11),
  version: 4,
  direction: "increase",
  amount_minor: "500",
  currency: "TRY",
  occurred_at: "2026-11-05T10:00:00Z",
  method: "bank_transfer",
  previous_id: null,
};
const accountPage = {
  view: "payments",
  items: [ledger],
  next_cursor: null,
  as_of: "2026-11-16T12:00:00Z",
  totals,
};
it("omits the interval for all-period native payments and uses real self with its own cursor", async () => {
  mock.call.mockResolvedValue(accountPage);
  const value = await readInstructorAccount(scope, id(4), "payments", undefined, "next");
  expect(value.totals).toEqual(totals);
  expect(value.payments).toEqual([ledger]);
  expect(mock.call).toHaveBeenCalledWith(
    "instructor_account_get_v1",
    expect.objectContaining({
      person_id: id(4),
      center_id: scope.centerId,
      view: "payments",
      page: { limit: 20, cursor: "next" },
    }),
  );
  expect(mock.call.mock.calls[0]![1]).not.toHaveProperty("interval");
});
it("keeps actual payment time, signed totals and unknown historical methods", async () => {
  mock.call.mockResolvedValue({
    ...accountPage,
    items: [
      {
        ...ledger,
        id: id(12),
        root_payment_id: ledger.id,
        previous_id: ledger.id,
        direction: "decrease",
        method: null,
      },
    ],
  });
  const value = await readInstructorAccount(scope, id(4), "payments", interval);
  expect(value.payments[0]).toMatchObject({
    direction: "decrease",
    method: null,
    root_payment_id: ledger.id,
  });
  expect(value.totals[0]).toMatchObject({ paid_minor: "-500", remaining_minor: "700" });
});
it("rejects wrong views, repeated cursors, duplicate currencies and out-of-period payments", async () => {
  for (const value of [
    { ...accountPage, view: "agreements" },
    { ...accountPage, next_cursor: "same" },
    { ...accountPage, totals: [totals[0], totals[0]] },
    { ...accountPage, items: [{ ...ledger, occurred_at: interval.ends_at }] },
    { ...accountPage, items: [ledger, ledger] },
    { ...accountPage, items: [{ ...ledger, root_payment_id: id(99) }] },
  ]) {
    mock.call.mockResolvedValue(value);
    await expect(
      readInstructorAccount(scope, id(4), "payments", interval, "same"),
    ).rejects.toThrow();
  }
});
it("retains an immutable agreement alias authorized by the native self reader", async () => {
  const agreement = {
    id: id(15),
    version: 3,
    person_id: id(99),
    center_id: scope.centerId,
    discipline_id: id(16),
    format: "group",
    valid: { starts_at: "2026-01-01T00:00:00Z", ends_at: null },
    terms: {
      model: "session_fixed",
      currency: "TRY",
      components: [{ kind: "session_fixed", amount_minor: "50000" }],
      room_fee: { kind: "free", order: "before_instructor_share" },
    },
    supersedes_id: null,
    published_at: "2026-01-01T00:00:00Z",
  };
  mock.call.mockResolvedValue({ ...accountPage, view: "agreements", items: [agreement] });
  expect((await readInstructorAccount(scope, id(4), "agreements")).agreements[0]).toMatchObject({
    person_id: id(99),
    version: 3,
  });
  mock.call.mockResolvedValue({
    ...accountPage,
    view: "agreements",
    items: [{ ...agreement, center_id: id(99) }],
  });
  await expect(readInstructorAccount(scope, id(4), "agreements")).rejects.toThrow(
    "INSTRUCTOR_ACCOUNT_UNAVAILABLE",
  );
  mock.call.mockResolvedValue({
    ...accountPage,
    view: "agreements",
    items: [{ ...agreement, valid: { ...agreement.valid, ends_at: "2026-10-01T00:00:00Z" } }],
  });
  await expect(readInstructorAccount(scope, id(4), "agreements")).rejects.toThrow(
    "INSTRUCTOR_ACCOUNT_UNAVAILABLE",
  );
});
