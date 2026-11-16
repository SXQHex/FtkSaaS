import { beforeEach, it, expect, vi } from "vitest";
import type {
  EntitlementView,
  Preview,
  TableFreezes,
  FreezeCancellationPreview,
} from "../../lib/api-contracts/generated";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  previewFreeze,
  freezeIntent,
  writeFreeze,
  readFreezeReceipt,
  readFreezeResult,
} from "./freeze";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) },
  person = id(4),
  sale = id(5),
  freezeId = id(6),
  previewId = id(7),
  reservation = id(8);
const draft = {
  startDate: "2099-01-12",
  endDate: "2099-01-14",
  reason: " Synthetic freeze reason ",
};
const record = (): TableFreezes => ({
  id: freezeId,
  org_id: scope.orgId,
  sale_id: sale,
  created_at: "2026-11-16T00:00:00Z",
  version: 1,
  starts_at: "2099-01-11T21:00:00Z",
  planned_end: "2099-01-13T21:00:00Z",
  state: "scheduled",
  preview_id: previewId,
});
let row: EntitlementView, preview: Preview;
beforeEach(() => {
  row = {
    sale_id: sale,
    account_id: id(10),
    person_id: person,
    version: 1,
    sale_version: 1,
    sale_state: "active",
    start_date: "2000-01-01",
    end_date: "2099-01-31",
    timezone: "Europe/Istanbul",
    state: "active",
    kind: "credits",
    available: 8,
    reserved: 0,
    consumed: 0,
    deficit: 0,
    quotas: [],
    deficit_scopes: [],
    freezes: [],
  };
  preview = {
    id: previewId,
    token: "synthetic-freeze-capability",
    scope_hash: "synthetic",
    dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
    effects: [{ entity: { type: "sales", id: sale }, action: "adjust", quantity: 2 }],
    blockers: [],
    expires_at: "2099-01-01T00:00:00Z",
  };
  call.mockReset();
  call.mockImplementation(async (op) => {
    if (op === "entitlements_get_v1") return [row];
    if (op === "freeze_preview_v1" || op === "freeze_end_preview_v1") return preview;
    if (op === "freeze_apply_v1" || op === "freeze_end_apply_v1")
      return { primary_id: freezeId, changed: [], jobs: [] };
    if (op === "management_state_get_v1")
      return {
        items: [
          {
            operation: "reservation_cancel_v1",
            exists: true,
            state: "active",
            as_of: "2026-11-16T08:00:00Z",
            entity: { type: "reservations", id: reservation },
            current: {
              operation: "reservation_cancel_v1",
              values: { reservation_id: reservation },
            },
            versions: [
              {
                entity: { type: "reservations", id: reservation },
                version: row.version === 1 ? 3 : 4,
              },
            ],
          },
        ],
        next_cursor: null,
        as_of: "2026-11-16T08:00:00Z",
      };
    throw new Error("UNEXPECTED_OPERATION");
  });
});
it("rejects invalid dates, foreign freeze scope and an unstarted full-cancellation attempt before a preview", async () => {
  await expect(
    previewFreeze(scope, person, sale, "freeze", { ...draft, endDate: draft.startDate }),
  ).rejects.toThrow();
  const f = record();
  row.freezes = [{ ...f, org_id: id(99) }];
  await expect(previewFreeze(scope, person, sale, "freeze", draft)).rejects.toThrow(
    "PROFILE_FREEZE_SOURCE_UNAVAILABLE",
  );
  row.freezes = [f];
  await expect(previewFreeze(scope, person, sale, "unfreeze", draft, f.id)).rejects.toThrow(
    "FREEZE_CANCEL_UNAVAILABLE",
  );
  expect(
    call.mock.calls.some((x) => x[0] === "freeze_preview_v1" || x[0] === "freeze_end_preview_v1"),
  ).toBe(false);
});
it("rejects a wrong root or cancellation effect instead of promising preserved reservations", async () => {
  preview.effects[0]!.entity.id = id(99);
  await expect(previewFreeze(scope, person, sale, "freeze", draft)).rejects.toThrow(
    "PROFILE_FREEZE_PREVIEW_UNAVAILABLE",
  );
  preview.effects[0]!.entity.id = sale;
  preview.effects.push({ entity: { type: "reservations", id: reservation }, action: "cancel" });
  await expect(previewFreeze(scope, person, sale, "freeze", draft)).rejects.toThrow(
    "PROFILE_FREEZE_PREVIEW_UNAVAILABLE",
  );
});
it("freezes the exact native capability/key and reads a new freeze in the sale timezone without inventing validity", async () => {
  const review = await previewFreeze(scope, person, sale, "freeze", draft),
    intent = freezeIntent(review);
  expect(review.request).toMatchObject({
    sale_id: sale,
    dates: { start_date: draft.startDate, end_date: draft.endDate },
    reason: "Synthetic freeze reason",
  });
  await writeFreeze(intent);
  await writeFreeze(intent);
  const writes = call.mock.calls.filter((x) => x[0] === "freeze_apply_v1");
  expect(writes).toHaveLength(2);
  expect({ ...writes[0]![1], request_id: null }).toEqual({ ...writes[1]![1], request_id: null });
  expect(writes[0]![1].request_id).not.toBe(writes[1]![1].request_id);
  expect(writes[0]![1]).not.toHaveProperty("dates");
  expect(writes[0]![1]).not.toHaveProperty("expected_version");
  row.version = 2;
  row.freezes = [record()];
  row.end_date = "2099-02-02";
  const result = await readFreezeResult(intent, freezeId);
  expect(result.rights[0]!.end_date).toBe("2099-02-02");
  row.freezes[0]!.preview_id = id(99);
  await expect(readFreezeResult(intent, freezeId)).rejects.toThrow(
    "PROFILE_FREEZE_RESULT_UNAVAILABLE",
  );
});
it("resolves only preview-listed obligations and checks that their newer native versions remain active", async () => {
  preview.effects.push({ entity: { type: "reservations", id: reservation }, action: "adjust" });
  const review = await previewFreeze(scope, person, sale, "freeze", draft);
  expect(review.bindings).toEqual([{ id: reservation, version: 3 }]);
  const intent = freezeIntent(review);
  row.version = 2;
  row.freezes = [record()];
  await expect(readFreezeResult(intent, freezeId)).resolves.toHaveProperty("rights");
  const native = call.getMockImplementation()!;
  call.mockImplementation((op, req) =>
    op === "management_state_get_v1"
      ? Promise.resolve({ items: [], next_cursor: null, as_of: "2026-11-16T08:00:00Z" })
      : native(op, req),
  );
  await expect(readFreezeResult(intent, freezeId)).rejects.toThrow(
    "PROFILE_FREEZE_BINDING_UNAVAILABLE",
  );
});
it("ends an already-started interval by the selected date and rejects another root in its receipt", async () => {
  const f = { ...record(), starts_at: "2000-01-01T21:00:00Z" };
  row.freezes = [f];
  preview.effects = [{ entity: { type: "freezes", id: freezeId }, action: "adjust" }];
  const review = await previewFreeze(
      scope,
      person,
      sale,
      "unfreeze",
      { endDate: "2099-01-13", reason: "Synthetic end reason" },
      freezeId,
    ),
    intent = freezeIntent(review);
  expect(intent.operation).toBe("freeze_end_apply_v1");
  expect(review.request).toMatchObject({ freeze_id: freezeId, end_date: "2099-01-13" });
  row.version = 2;
  row.freezes = [{ ...f, version: 2, state: "ended", actual_end: "2099-01-12T21:00:00Z" }];
  await expect(readFreezeResult(intent, freezeId)).resolves.toHaveProperty("rights");
  call.mockResolvedValueOnce({
    operation: intent.operation,
    key: intent.request.operation_key,
    status: "succeeded",
    result_reference: { type: "freezes", id: id(99) },
  });
  await expect(readFreezeReceipt(intent)).rejects.toThrow("PROFILE_FREEZE_RECEIPT_UNAVAILABLE");
});

function cancelQuote(days = 2): FreezeCancellationPreview {
  row.freezes = [record()];
  return {
    ...preview,
    effects: [
      { entity: { type: "freezes", id: freezeId }, action: "cancel" },
      { entity: { type: "sales", id: sale }, action: "adjust", quantity: days },
    ],
    freeze_cancellation: {
      freeze_id: freezeId,
      sale_id: sale,
      state: "cancelled",
      removed_extension_days: days,
      previous_end_date: row.end_date,
      end_date: days ? "2099-01-29" : row.end_date,
      valid_until: days ? "2099-01-28T21:00:00Z" : "2099-01-30T21:00:00Z",
      preserves_reservations: true,
    },
  };
}
function useCancelQuote(quote: FreezeCancellationPreview) {
  const original = call.getMockImplementation()!;
  call.mockImplementation(async (op, request) =>
    op === "freeze_cancel_preview_v1"
      ? quote
      : op === "freeze_cancel_apply_v1"
        ? { primary_id: freezeId, changed: [], jobs: [] }
        : original(op, request),
  );
}
it("cancels the exact future freeze with only a reason and immutable native validity impact", async () => {
  const quote = cancelQuote();
  useCancelQuote(quote);
  const review = await previewFreeze(
    scope,
    person,
    sale,
    "cancelFreeze",
    { reason: " Synthetic cancel ", endDate: "not-collected" },
    freezeId,
  );
  expect(review.request).toEqual({
    client_api_version: 1,
    org_id: scope.orgId,
    center_id: scope.centerId,
    freeze_id: freezeId,
    reason: "Synthetic cancel",
  });
  expect(review.cancellation).toEqual(quote.freeze_cancellation);
  const intent = freezeIntent(review);
  expect(intent.operation).toBe("freeze_cancel_apply_v1");
  expect(intent.request).not.toHaveProperty("end_date");
  expect(intent.request).not.toHaveProperty("expected_version");
  await writeFreeze(intent);
  expect(
    call.mock.calls.some(([op]) => op === "freeze_end_preview_v1" || op === "freeze_end_apply_v1"),
  ).toBe(false);
});
it("accepts native zero extension removal without recomputing an earlier end date", async () => {
  const quote = cancelQuote(0);
  useCancelQuote(quote);
  const review = await previewFreeze(
    scope,
    person,
    sale,
    "cancelFreeze",
    { reason: "Synthetic" },
    freezeId,
  );
  expect(review.cancellation?.removed_extension_days).toBe(0);
  expect(review.cancellation?.end_date).toBe(row.end_date);
});
it("rejects started intervals, unrelated cancellation impacts and expired review before apply", async () => {
  const quote = cancelQuote();
  useCancelQuote(quote);
  row.freezes![0].starts_at = "2000-01-01T00:00:00Z";
  await expect(
    previewFreeze(scope, person, sale, "cancelFreeze", { reason: "Synthetic" }, freezeId),
  ).rejects.toThrow("PROFILE_FREEZE_CANCEL_UNAVAILABLE");
  row.freezes = [record()];
  quote.freeze_cancellation.sale_id = id(99);
  await expect(
    previewFreeze(scope, person, sale, "cancelFreeze", { reason: "Synthetic" }, freezeId),
  ).rejects.toThrow("PROFILE_FREEZE_PREVIEW_UNAVAILABLE");
  quote.freeze_cancellation.sale_id = sale;
  const review = await previewFreeze(
    scope,
    person,
    sale,
    "cancelFreeze",
    { reason: "Synthetic" },
    freezeId,
  );
  review.preview.expires_at = "2000-01-01T00:00:00Z";
  expect(() => freezeIntent(review)).toThrow("PROFILE_FREEZE_PREVIEW_UNAVAILABLE");
});
it("requires cancelled state, preserved planned interval and native new validity on result read", async () => {
  const quote = cancelQuote();
  useCancelQuote(quote);
  const review = await previewFreeze(
      scope,
      person,
      sale,
      "cancelFreeze",
      { reason: "Synthetic" },
      freezeId,
    ),
    intent = freezeIntent(review);
  row = {
    ...row,
    version: 2,
    sale_version: 2,
    end_date: quote.freeze_cancellation.end_date,
    freezes: [
      { ...record(), version: 2, state: "cancelled", actual_end: null, extension_until: null },
    ],
  };
  expect((await readFreezeResult(intent, freezeId)).rights[0].freezes![0].state).toBe("cancelled");
  expect((await readFreezeResult(intent)).rights[0].freezes![0].id).toBe(freezeId);
  row.freezes![0].actual_end = "2099-01-12T00:00:00Z";
  await expect(readFreezeResult(intent, freezeId)).rejects.toThrow(
    "PROFILE_FREEZE_RESULT_UNAVAILABLE",
  );
  row.freezes![0].actual_end = null;
  row.freezes![0].planned_end = "2099-01-14T21:00:00Z";
  await expect(readFreezeResult(intent, freezeId)).rejects.toThrow(
    "PROFILE_FREEZE_RESULT_UNAVAILABLE",
  );
});

it("keeps first-invalid date focus ordering before the reason on the existing freeze form", async () => {
  let failure: unknown;
  try {
    await previewFreeze(scope, person, sale, "freeze", { startDate: "", endDate: "", reason: "" });
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({
    issues: [{ path: ["startDate"] }, { path: ["endDate"] }, { path: ["reason"] }],
  });
  expect(call).not.toHaveBeenCalled();
});
