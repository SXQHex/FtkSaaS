import { beforeEach, expect, it, vi } from "vitest";
import type { FinanceView } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  financeDraft,
  collectionIntent,
  readFinancePage,
  readCollectionAuthority,
  writeCollection,
  readCollectionResult,
  readCollectionReceipt,
} from "./finance";
const scope = {
    accountId: "019a7b00-0000-7000-8000-000000000002",
    orgId: "019a7b00-0000-7000-8000-000000000003",
    centerId: "019a7b00-0000-7000-8000-000000000004",
  },
  selection = { personId: "019a7b00-0000-7000-8000-000000000006", currency: "TRY" },
  cashId = "019a7b00-0000-7000-8000-000000000021";
function draft() {
  return {
    ...financeDraft(selection),
    amount: "40000",
    method: "bank_transfer" as const,
    reference: "SYNTHETIC-REF",
    occurredAt: "2026-11-15T14:30",
  };
}
function source(): FinanceView {
  return {
    person_id: selection.personId,
    currency: "TRY",
    debts: [
      {
        id: "019a7b00-0000-7000-8000-000000000022",
        due_at: "2026-11-15T00:00:00Z",
        remaining_minor: "60000",
        center_id: scope.centerId,
        version: 2,
      },
    ],
    credit_available_minor: "0",
    movements: {
      items: [
        {
          id: cashId,
          kind: "collection",
          amount_minor: "40000",
          currency: "TRY",
          occurred_at: "2026-11-15T11:30:00Z",
          center_id: scope.centerId,
          version: 1,
          previous_id: null,
          payment: { method: "bank_transfer", reference: "SYNTHETIC-REF" },
        },
      ],
      next_cursor: null,
      as_of: "2026-11-15T12:00:00Z",
    },
  };
}
beforeEach(() => {
  call.mockReset();
});
it("reads only the explicit person/currency/center and rejects a foreign financial projection", async () => {
  call.mockResolvedValue(source());
  await readFinancePage(scope, selection, "native-cursor");
  expect(call.mock.calls[0]![1]).toMatchObject({
    person_id: selection.personId,
    currency: "TRY",
    center_id: scope.centerId,
    page: { limit: 20, cursor: "native-cursor" },
  });
  expect(call.mock.calls[0]![1]).not.toHaveProperty("query");
  call.mockResolvedValue({ ...source(), currency: "EUR" });
  await expect(readFinancePage(scope, selection)).rejects.toThrow("FINANCE_SOURCE_UNAVAILABLE");
  const wrong = source();
  wrong.movements.items[0]!.center_id = scope.orgId;
  call.mockResolvedValue(wrong);
  await expect(readFinancePage(scope, selection)).rejects.toThrow("FINANCE_SOURCE_UNAVAILABLE");
});
it("uses the native writer authority selector and never derives collection permission from a finance read", async () => {
  const row = {
    exists: true,
    entity: { type: "people", id: selection.personId },
    current: { operation: "collection_record_v1", values: { person_id: selection.personId } },
  };
  call.mockResolvedValue({ items: [row], next_cursor: null });
  expect(await readCollectionAuthority(scope, selection.personId)).toBe(true);
  expect(call.mock.calls[0]![1].selector).toEqual({
    operation: "collection_record_v1",
    key: { person_id: selection.personId },
  });
  call.mockResolvedValue({
    items: [{ ...row, entity: { type: "people", id: scope.accountId } }],
    next_cursor: null,
  });
  await expect(readCollectionAuthority(scope, selection.personId)).rejects.toThrow(
    "FINANCE_AUTHORITY_UNAVAILABLE",
  );
  call.mockRejectedValue(
    new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: "synthetic" }),
  );
  expect(await readCollectionAuthority(scope, selection.personId)).toBe(false);
  const transport = new BackendError();
  call.mockRejectedValue(transport);
  await expect(readCollectionAuthority(scope, selection.personId)).rejects.toBe(transport);
});
it("requires explicit method/reference and preserves exact integer amounts and frozen selection", async () => {
  const value = draft();
  value.amount = "9007199254740993";
  const intent = await collectionIntent(scope, selection, "Europe/Istanbul", value);
  value.amount = "1";
  expect(intent.request.amount_minor).toBe("9007199254740993");
  expect(intent.request.occurred_at).toBe("2026-11-15T11:30:00Z");
  expect(intent.request.payment).toEqual({ method: "bank_transfer", reference: "SYNTHETIC-REF" });
  await expect(
    collectionIntent(scope, selection, "Europe/Istanbul", { ...draft(), reference: "  " }),
  ).rejects.toThrow();
  await expect(
    collectionIntent(scope, selection, "Europe/Istanbul", { ...draft(), currency: "EUR" }),
  ).rejects.toThrow("FINANCE_SCOPE_CHANGED");
  await expect(
    collectionIntent(scope, selection, "Europe/Istanbul", { ...draft(), amount: "0" }),
  ).rejects.toThrow();
  await expect(
    collectionIntent(scope, selection, "Europe/Istanbul", {
      ...draft(),
      amount: "9223372036854775808",
    }),
  ).rejects.toThrow();
});
it("rejects skipped and repeated local times instead of silently selecting an offset", async () => {
  for (const occurredAt of ["2026-03-08T02:30", "2026-11-01T01:30"])
    await expect(
      collectionIntent(scope, selection, "America/New_York", { ...draft(), occurredAt }),
    ).rejects.toThrow("FINANCE_TIME_INVALID");
});
it("retries the exact same collection key/payload with a fresh request ID and no fake preview", async () => {
  const intent = await collectionIntent(scope, selection, "Europe/Istanbul", draft());
  call.mockResolvedValue({ primary_id: cashId });
  await writeCollection(intent);
  await writeCollection(intent);
  expect(call.mock.calls[0]![0]).toBe("collection_record_v1");
  const first = call.mock.calls[0]![1],
    second = call.mock.calls[1]![1];
  expect(first.operation_key).toBe(second.operation_key);
  expect(first.request_id).not.toBe(second.request_id);
  expect(first.payment).toEqual(second.payment);
  expect(first).not.toHaveProperty("preview");
  expect(first).not.toHaveProperty("debt_ids");
});
it("rereads the exact acknowledged root movement across native cursors and verifies its amount", async () => {
  const intent = await collectionIntent(scope, selection, "Europe/Istanbul", draft());
  const empty = source();
  empty.movements = { ...empty.movements, items: [], next_cursor: "next" };
  call.mockResolvedValueOnce(empty).mockResolvedValueOnce(source());
  expect((await readCollectionResult(intent, cashId)).debts[0]!.remaining_minor).toBe("60000");
  expect(call.mock.calls[1]![1].page.cursor).toBe("next");
  const wrong = source();
  wrong.movements.items[0]!.amount_minor = "40001";
  call.mockResolvedValue(wrong);
  await expect(readCollectionResult(intent, cashId)).rejects.toThrow("FINANCE_RESULT_UNAVAILABLE");
  call.mockResolvedValue({
    operation: intent.operation,
    key: intent.request.operation_key,
    result_reference: { type: "debts", id: cashId },
  });
  await expect(readCollectionReceipt(intent)).rejects.toThrow("FINANCE_RECEIPT_UNAVAILABLE");
});

it("accepts RFC3339 offset timestamps from the native financial projection", async () => {
  const data = source();
  data.movements.items[0]!.occurred_at = "2026-11-15T11:30:00+00:00";
  data.debts[0]!.due_at = "2026-11-15T00:00:00+00:00";
  call.mockResolvedValue(data);
  const intent = await collectionIntent(scope, selection, "Europe/Istanbul", draft());
  expect(await readCollectionResult(intent, cashId)).toEqual(data);
});
