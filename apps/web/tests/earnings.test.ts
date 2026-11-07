import type { EarningView } from "@ftksaas/api-contracts";
import { expect, test, vi } from "vitest";
import { earningsApi, paymentCommand, validPaymentCommand } from "../src/lib/earnings";
import { setupCall } from "../src/lib/studio-setup";
vi.mock("../src/lib/studio-setup", () => ({ setupCall: vi.fn<typeof setupCall>() }));
const person = "019a2b3c-4d5e-7000-8000-000000000001",
  center = "019a2b3c-4d5e-7000-8000-000000000002",
  id = "019a2b3c-4d5e-7000-8000-000000000003",
  payment = "019a2b3c-4d5e-7000-8000-000000000004";
const scope = { actorId: person, orgId: person, centerId: center },
  interval = { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" };
const row: EarningView = {
  id,
  person_id: person,
  center_id: center,
  session_id: id,
  event_assignment_id: null,
  amount_minor: "20000",
  paid_minor: "1000",
  remaining_minor: "19000",
  overpaid_minor: "0",
  direction: "add",
  previous_id: null,
  closure_id: id,
  version: 1,
  created_at: "2026-11-07T00:00:00Z",
  basis: { source: "lesson_agreement", currency: "TRY", quantity: 1, excluded_blocked: 0 },
  currency: "TRY",
  payments: [],
};
test("earnings query stays on the explicitly selected person, center and interval", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce({
    items: [row],
    next_cursor: null,
    as_of: interval.starts_at,
  } as never);
  const page = await earningsApi.list(scope, person, interval);
  expect(page.items[0].amount_minor).toBe("20000");
  expect(setupCall).toHaveBeenLastCalledWith(
    "earnings_list_v1",
    expect.objectContaining({ person_id: person, center_id: center, interval }),
  );
});
test.each([
  { ...row, person_id: center },
  { ...row, center_id: person },
  { ...row, version: 0 },
  { ...row, remaining_minor: "-1" },
])("earnings reader rejects wrong identity and invalid balances", async (item) => {
  vi.mocked(setupCall).mockResolvedValueOnce({
    items: [item],
    next_cursor: null,
    as_of: interval.starts_at,
  } as never);
  await expect(earningsApi.list(scope, person, interval)).rejects.toThrow("invalidEarnings");
});
test("payment records only selected current earnings and resolves actual local time", () => {
  const draft = paymentCommand(scope, person, [structuredClone(row)], {
    amount: "12,50",
    currency: "TRY",
    localTime: "2020-01-01T12:00",
    timeZone: "Europe/Istanbul",
    offset: "",
    earningIds: [id],
  });
  expect(draft.command.input).toMatchObject({
    person_id: person,
    earning_ids: [id],
    amount_minor: "1250",
    occurred_at: "2020-01-01T09:00:00.000Z",
  });
  expect(
    validPaymentCommand(draft.command.operation, draft.command.input, center, draft.slot),
  ).toBe(true);
  expect(() =>
    paymentCommand(scope, person, [structuredClone(row)], {
      amount: "12",
      currency: "EUR",
      localTime: "2020-01-01T12:00",
      timeZone: "UTC",
      offset: "",
      earningIds: [id],
    }),
  ).toThrow("invalidEarnings");
});
test("correction carries original payment version, currency, positive delta and explicit reason", () => {
  const original = {
    id: payment,
    version: 3,
    amount_minor: "1000",
    net_minor: "800",
    currency: "TRY",
    occurred_at: "2020-01-01T00:00:00Z",
    corrections: [],
  };
  const draft = paymentCommand(scope, person, [{ ...structuredClone(row), payments: [original] }], {
    amount: "2",
    currency: "TRY",
    localTime: "2020-01-02T12:00",
    timeZone: "UTC",
    offset: "",
    earningIds: [],
    payment: original,
    direction: "decrease",
    reason: "Düzeltme",
  });
  expect(draft.command.input).toMatchObject({
    payment_id: payment,
    expected_version: 3,
    reason: "Düzeltme",
    correction: { amount_minor: "200", currency: "TRY", direction: "decrease" },
  });
  expect(
    validPaymentCommand(
      draft.command.operation,
      draft.command.input,
      center,
      `instructor-payment:${id}`,
    ),
  ).toBe(false);
});
test("earnings report uses the identical person/center/interval and retains query totals", async () => {
  const filters = { interval, center_ids: [center], person_ids: [person] };
  const report = {
    report_kind: "earnings",
    as_of: interval.starts_at,
    filters,
    rows: {
      items: [
        {
          group_key: "earning_accrual",
          center_id: center,
          person_id: person,
          currency: "TRY",
          count: 2,
          amount_minor: "30000",
        },
      ],
      next_cursor: "report-next",
      as_of: interval.starts_at,
    },
    totals: [{ currency: "TRY", count: 2, amount_minor: "30000" }],
  };
  vi.mocked(setupCall).mockResolvedValueOnce(report as never);
  const result = await earningsApi.report(scope, person, interval);
  expect(result.totals).toEqual(report.totals);
  expect(result.rows.next_cursor).toBe("report-next");
  expect(setupCall).toHaveBeenLastCalledWith(
    "report_get_v1",
    expect.objectContaining({ report: "earnings", center_id: center, filters }),
  );
});
test.each(["wrong-person", "invalid-money", "repeated-cursor"])(
  "report rejects %s without presenting a successful comparison",
  async (kind) => {
    const report = {
      report_kind: "earnings",
      as_of: interval.starts_at,
      filters: { interval, center_ids: [center], person_ids: [person] },
      rows: {
        items: [
          {
            group_key: "earning_accrual",
            center_id: center,
            person_id: kind === "wrong-person" ? center : person,
            currency: "TRY",
            amount_minor: kind === "invalid-money" ? "NaN" : "30000",
            count: 1,
          },
        ],
        next_cursor: kind === "repeated-cursor" ? "same" : null,
        as_of: interval.starts_at,
      },
      totals: [],
    };
    vi.mocked(setupCall).mockResolvedValueOnce(report as never);
    await expect(
      earningsApi.report(scope, person, interval, kind === "repeated-cursor" ? "same" : undefined),
    ).rejects.toThrow("invalidEarnings");
  },
);
test("payment projection rejects a foreign-currency payment and correction requires a read source", async () => {
  const payment = {
    id: person,
    version: 1,
    amount_minor: "1000",
    net_minor: "1000",
    currency: "EUR",
    occurred_at: "2020-01-01T00:00:00Z",
    corrections: [],
  };
  vi.mocked(setupCall).mockResolvedValueOnce({
    items: [{ ...row, payments: [payment] }],
    next_cursor: null,
    as_of: interval.starts_at,
  } as never);
  await expect(earningsApi.list(scope, person, interval)).rejects.toThrow("invalidEarnings");
  expect(() =>
    paymentCommand(scope, person, [row], {
      amount: "1",
      currency: "EUR",
      localTime: "2020-01-01T12:00",
      timeZone: "UTC",
      offset: "",
      earningIds: [],
      payment,
      direction: "decrease",
      reason: "Düzeltme",
    }),
  ).toThrow("invalidEarnings");
});
