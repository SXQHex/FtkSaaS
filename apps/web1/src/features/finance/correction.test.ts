import { beforeEach, expect, it, vi } from "vitest";
import type { Preview, CashSummary, FinanceView } from "../../lib/api-contracts/generated";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  readCorrectionBase,
  previewCorrection,
  correctionIntent,
  writeCorrection,
  readCorrectionResult,
  readCorrectionReceipt,
  type CorrectionBase,
} from "./correction";
import { financeDraft } from "./finance";
const scope = {
    accountId: "019a7b00-0000-7000-8000-000000000002",
    orgId: "019a7b00-0000-7000-8000-000000000003",
    centerId: "019a7b00-0000-7000-8000-000000000004",
  },
  selection = { personId: "019a7b00-0000-7000-8000-000000000006", currency: "TRY" };
const root = "019a7b00-0000-7000-8000-000000000061",
  child = "019a7b00-0000-7000-8000-000000000063",
  previewId = "019a7b00-0000-7000-8000-000000000064";
const cash: CashSummary = {
  id: root,
  kind: "collection",
  currency: "TRY",
  amount_minor: "40000",
  occurred_at: "2026-11-15T11:30:00Z",
  previous_id: null,
  payment: { method: "cash" },
  version: 1,
  center_id: scope.centerId,
};
const base: CorrectionBase = { scope, selection, movement: cash, version: 1 };
const draft = () => ({
  ...financeDraft(selection),
  amount: "10000",
  direction: "decrease" as const,
  reason: "Synthetic correction",
  occurredAt: "2026-11-15T15:00",
});
function preview(): Preview {
  return {
    id: previewId,
    token: "synthetic-preview-capability",
    scope_hash: "synthetic",
    dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
    effects: [
      {
        entity: { type: "cash_movements", id: root },
        action: "adjust",
        reason: "Synthetic correction",
        amount_minor: "10000",
        currency: "TRY",
      },
      {
        entity: { type: "people", id: selection.personId },
        action: "reverse",
        amount_minor: "10000",
        currency: "TRY",
      },
    ],
    blockers: [],
    expires_at: "2099-01-01T00:00:00Z",
  };
}
function data(rows: CashSummary[]): FinanceView {
  return {
    person_id: selection.personId,
    currency: "TRY",
    debts: [],
    credit_available_minor: "30000",
    movements: { items: rows, next_cursor: null, as_of: "2026-11-15T13:00:00Z" },
  };
}
beforeEach(() => {
  call.mockReset();
});
it("requires exact native correction authority before loading the root collection", async () => {
  const state = {
    exists: true,
    entity: { type: "cash_movements", id: root },
    versions: [{ entity: { type: "cash_movements", id: root }, version: 1 }],
    current: { operation: "collection_correct_preview_v1", values: { cash_movement_id: root } },
  };
  call.mockImplementation(async (op) =>
    op === "management_state_get_v1" ? { items: [state], next_cursor: null } : data([cash]),
  );
  expect((await readCorrectionBase(scope, selection, root)).movement).toEqual(cash);
  expect(call.mock.calls[0]![1].selector).toEqual({
    operation: "collection_correct_preview_v1",
    key: { cash_movement_id: root },
  });
  state.current.values.cash_movement_id = child;
  await expect(readCorrectionBase(scope, selection, root)).rejects.toThrow(
    "FINANCE_AUTHORITY_UNAVAILABLE",
  );
});
it("sends a directed difference, source root and reason without a replacement total or payment method", async () => {
  call.mockResolvedValue(preview());
  const review = await previewCorrection(base, "Europe/Istanbul", draft());
  expect(call.mock.calls[0]).toEqual([
    "collection_correct_preview_v1",
    expect.objectContaining({
      cash_movement_id: root,
      correction: {
        amount_minor: "10000",
        currency: "TRY",
        direction: "decrease",
        occurred_at: "2026-11-15T12:00:00Z",
      },
      reason: "Synthetic correction",
    }),
  ]);
  expect(call.mock.calls[0]![1]).not.toHaveProperty("payment");
  const intent = correctionIntent(review);
  expect(intent.request.preview).toEqual({ id: previewId, token: review.preview.token });
  expect(intent.request).not.toHaveProperty("correction");
  expect(intent.base.movement.amount_minor).toBe("40000");
});
it("rejects a wrong-root effect, blockers and expiry instead of authorizing an apply", async () => {
  const wrong = preview();
  wrong.effects[0]!.entity.id = child;
  call.mockResolvedValue(wrong);
  await expect(previewCorrection(base, "Europe/Istanbul", draft())).rejects.toThrow(
    "FINANCE_PREVIEW_UNAVAILABLE",
  );
  call.mockResolvedValue(preview());
  const review = await previewCorrection(base, "Europe/Istanbul", draft());
  review.preview.expires_at = "2000-01-01T00:00:00Z";
  expect(() => correctionIntent(review)).toThrow("FINANCE_PREVIEW_STALE");
  review.preview.expires_at = "2099-01-01T00:00:00Z";
  review.preview.blockers = [{ code: "VALIDATION_FAILED", retryable: false, trace_id: previewId }];
  expect(() => correctionIntent(review)).toThrow("FINANCE_PREVIEW_STALE");
});
it("reuses one reviewed apply capability and key with fresh request IDs", async () => {
  call.mockResolvedValue(preview());
  const review = await previewCorrection(base, "Europe/Istanbul", draft()),
    intent = correctionIntent(review);
  call.mockReset();
  call.mockResolvedValue({ primary_id: child });
  await writeCorrection(intent);
  await writeCorrection(intent);
  expect(call.mock.calls[0]![0]).toBe("collection_correct_apply_v1");
  const a = call.mock.calls[0]![1],
    b = call.mock.calls[1]![1];
  expect(a.operation_key).toBe(b.operation_key);
  expect(a.preview).toEqual(b.preview);
  expect(a.request_id).not.toBe(b.request_id);
});
it("verifies the linked child and immutable original before accepting the financial reread", async () => {
  call.mockResolvedValue(preview());
  const intent = correctionIntent(await previewCorrection(base, "Europe/Istanbul", draft()));
  const linked: CashSummary = {
    ...cash,
    id: child,
    kind: "correction_out",
    amount_minor: "10000",
    occurred_at: "2026-11-15T12:00:00+00:00",
    previous_id: root,
    payment: null,
  };
  call.mockResolvedValue(data([linked, cash]));
  expect((await readCorrectionResult(intent, child)).credit_available_minor).toBe("30000");
  call.mockResolvedValue(data([{ ...linked, previous_id: previewId }, cash]));
  await expect(readCorrectionResult(intent, child)).rejects.toThrow("FINANCE_RESULT_UNAVAILABLE");
  call.mockResolvedValue(data([linked, { ...cash, amount_minor: "30000" }]));
  await expect(readCorrectionResult(intent, child)).rejects.toThrow("FINANCE_RESULT_UNAVAILABLE");
});
it("rejects an unrelated receipt entity instead of treating it as the acknowledged correction", async () => {
  call.mockResolvedValue(preview());
  const intent = correctionIntent(await previewCorrection(base, "Europe/Istanbul", draft()));
  call.mockResolvedValue({
    operation: intent.operation,
    key: intent.request.operation_key,
    result_reference: { type: "debts", id: child },
  });
  await expect(readCorrectionReceipt(intent)).rejects.toThrow("FINANCE_RECEIPT_UNAVAILABLE");
});
