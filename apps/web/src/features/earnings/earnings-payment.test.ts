import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call: mock.call }) }));
import {
  earningsPaymentIntent,
  writeEarningsPayment,
  readEarningsPaymentReceipt,
  readEarningsPaymentResult,
  readEarningsPaymentChain,
} from "./earnings-payment";
import type { InstructorFinanceEarning, InstructorFinancePayment } from "@ftksaas/api-contracts";
import type { EarningsPaymentDraft } from "./earnings-payment-sheet";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const row: InstructorFinanceEarning = {
  kind: "earning",
  display_name: "Örnek Eğitmen",
  session_name: "Tango",
  agreement_id: null,
  agreement_version: null,
  earning: {
    id: id(5),
    person_id: id(4),
    center_id: scope.centerId,
    session_id: id(6),
    event_assignment_id: null,
    amount_minor: "100000",
    currency: "TRY",
    paid_minor: "0",
    remaining_minor: "100000",
    direction: "add",
    previous_id: null,
    closure_id: null,
    created_at: "2026-11-01T12:00:00Z",
    version: 1,
    basis: { source: "agreement_fixed", currency: "TRY", quantity: 1, excluded_blocked: 0 },
  },
};
const root: InstructorFinancePayment = {
  kind: "payment",
  id: id(7),
  person_id: id(4),
  display_name: "Örnek Eğitmen",
  root_payment_id: id(7),
  version: 1,
  previous_id: null,
  direction: "increase",
  amount_minor: "20000",
  currency: "TRY",
  occurred_at: "2026-11-10T12:00:00Z",
  payment: { method: "cash" },
  reason: null,
};
const draft: EarningsPaymentDraft = {
  personId: id(4),
  amount: "123,45",
  date: "2026-11-16T14:00",
  method: "bank_transfer",
  reference: "TEST-REF",
  direction: "decrease",
  reason: "Düzeltme nedeni",
  earningIds: [id(5)],
};
const source = { personId: id(4), earnings: [row] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());
it("prepares exact selected earning allocations, currency minor units and center-local instant without note or advance", async () => {
  const intent = await earningsPaymentIntent(scope, draft, "TRY", "Europe/Istanbul", source);
  expect(intent.operation).toBe("instructor_payment_record_v1");
  expect(intent.request).toMatchObject({
    person_id: id(4),
    earning_ids: [id(5)],
    amount_minor: "12345",
    occurred_at: "2026-11-16T11:00:00Z",
    payment: { method: "bank_transfer", reference: "TEST-REF" },
  });
  expect(intent.request).not.toHaveProperty("note");
  expect(intent.request.operation_key).toMatch(/^[\da-f-]{14}7/);
});
it("rejects selected-root mismatch, foreign currency, duplicates, overpay and missing payment reference", async () => {
  for (const change of [
    { earningIds: [] },
    { earningIds: [id(5), id(5)] },
    { earningIds: [id(99)] },
    { personId: id(99) },
    { amount: "1000.01" },
    { amount: "0" },
    { amount: "1.234" },
    { amount: "NaN" },
    { reference: " " },
  ])
    await expect(
      earningsPaymentIntent(scope, { ...draft, ...change }, "TRY", "Europe/Istanbul", source),
    ).rejects.toThrow();
  await expect(
    earningsPaymentIntent(scope, draft, "USD", "Europe/Istanbul", source),
  ).rejects.toThrow();
});
it("rejects missing clock, client-zone/offset guessing and repeated or skipped DST local times", async () => {
  for (const date of [
    "2026-11-16",
    "2026-11-16T14:00+03:00",
    "2026-11-01T01:30",
    "2026-03-08T02:30",
  ])
    await expect(
      earningsPaymentIntent(scope, { ...draft, date }, "TRY", "America/New_York", source),
    ).rejects.toThrow("EARNINGS_TIME_INVALID");
});
it("preserves exact amounts above JS safe integer and currency-specific precision", async () => {
  const huge = { ...row, earning: { ...row.earning, remaining_minor: "9223372036854775807" } };
  const intent = await earningsPaymentIntent(
    scope,
    { ...draft, amount: "90071992547409.93" },
    "TRY",
    "Europe/Istanbul",
    { ...source, earnings: [huge] },
  );
  expect(intent.request).toHaveProperty("amount_minor", "9007199254740993");
  await expect(
    earningsPaymentIntent(
      scope,
      { ...draft, amount: "92233720368547758.08" },
      "TRY",
      "Europe/Istanbul",
      { ...source, earnings: [huge] },
    ),
  ).rejects.toThrow();
});
it("correction pins the actual root version, currency and explicit reason; original root is immutable", async () => {
  const before = structuredClone(root);
  const intent = await earningsPaymentIntent(scope, draft, "TRY", "Europe/Istanbul", {
    ...source,
    before: root,
  });
  expect(intent.request).toMatchObject({
    payment_id: root.id,
    expected_version: 1,
    reason: draft.reason,
    correction: { direction: "decrease", amount_minor: "12345", currency: "TRY" },
  });
  expect(root).toEqual(before);
  await expect(
    earningsPaymentIntent(scope, { ...draft, reason: "" }, "TRY", "Europe/Istanbul", {
      ...source,
      before: root,
    }),
  ).rejects.toThrow();
  await expect(
    earningsPaymentIntent(scope, draft, "EUR", "Europe/Istanbul", { ...source, before: root }),
  ).rejects.toThrow();
});
it("retry reuses the entire immutable operation and changes only transport request ID", async () => {
  const intent = await earningsPaymentIntent(scope, draft, "TRY", "Europe/Istanbul", source);
  mock.call.mockResolvedValue({
    operation_id: id(8),
    primary_id: id(7),
    replayed: false,
    related: [],
  });
  await writeEarningsPayment(intent);
  await writeEarningsPayment(intent);
  const first = mock.call.mock.calls[0]![1],
    second = mock.call.mock.calls[1]![1];
  expect(first.operation_key).toBe(second.operation_key);
  expect(first.request_id).not.toBe(second.request_id);
  expect({ ...first, request_id: null }).toEqual({ ...second, request_id: null });
});
it("receipt must match operation, key, subject type and correction root; a lookup never writes", async () => {
  const intent = await earningsPaymentIntent(scope, draft, "TRY", "Europe/Istanbul", {
    ...source,
    before: root,
  });
  mock.call.mockResolvedValue({
    operation: intent.operation,
    key: intent.request.operation_key,
    status: "succeeded",
    result_available: true,
    result_reference: { type: "instructor_payments", id: root.id },
  });
  await readEarningsPaymentReceipt(intent);
  expect(mock.call.mock.calls[0]![0]).toBe("operation_status_get_v1");
  mock.call.mockResolvedValue({
    operation: intent.operation,
    key: "wrong",
    status: "succeeded",
    result_reference: { type: "instructor_payments", id: root.id },
  });
  await expect(readEarningsPaymentReceipt(intent)).rejects.toThrow("EARNINGS_RECEIPT_MISMATCH");
});
it("reads only the selected instructor's complete versioned root chain with native pagination", async () => {
  const correction = {
    ...root,
    id: id(9),
    previous_id: root.id,
    direction: "decrease",
    amount_minor: "1000",
    reason: "Düzeltme",
  };
  mock.call.mockImplementation(async (_op: string, r: { page: { cursor?: string } }) => ({
    view: "payments",
    items: r.page.cursor ? [correction] : [{ ...root, version: 2 }],
    totals: [],
    next_cursor: r.page.cursor ? null : "next",
    as_of: "2026-11-17T12:00:00Z",
    closed_session_count: 0,
  }));
  const chain = await readEarningsPaymentChain(scope, id(4), root.id);
  expect(chain.rows).toHaveLength(2);
  expect(mock.call.mock.calls.every(([, r]) => r.person_id === id(4))).toBe(true);
});
it("post-ACK read rejects unrelated or unchanged roots and never repeats a writer", async () => {
  const intent = await earningsPaymentIntent(scope, draft, "TRY", "Europe/Istanbul", {
    ...source,
    before: root,
  });
  mock.call.mockResolvedValue({
    view: "payments",
    items: [root],
    totals: [],
    next_cursor: null,
    as_of: "2026-11-17T12:00:00Z",
    closed_session_count: 0,
  });
  await expect(readEarningsPaymentResult(intent, root.id)).rejects.toThrow(
    "EARNINGS_RESULT_MISMATCH",
  );
  expect(mock.call.mock.calls.every(([op]) => op === "instructor_finance_directory_get_v1")).toBe(
    true,
  );
  await expect(readEarningsPaymentResult(intent, id(99))).rejects.toThrow(
    "EARNINGS_RESULT_MISMATCH",
  );
});
