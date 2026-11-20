import { beforeEach, it, expect, vi } from "vitest";
import type { EntitlementView, ReservationProtectionPreview } from "@ftksaas/api-contracts";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  previewRightAdjustment,
  rightAdjustmentIntent,
  writeRightAdjustment,
  readRightAdjustmentReceipt,
  readRightAdjustmentResult,
} from "./right-adjustment";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) },
  person = id(4),
  sale = id(5),
  account = id(6),
  previewId = id(7);
const draft = {
  quantity: "2",
  direction: "increase",
  reason: " Synthetic reason ",
  endDate: "2026-12-20",
};
let row: EntitlementView, alter: ((p: ReservationProtectionPreview) => void) | undefined;
beforeEach(() => {
  row = {
    sale_id: sale,
    account_id: account,
    person_id: person,
    version: 3,
    sale_version: 1,
    sale_state: "active",
    start_date: "2026-11-01",
    end_date: "2026-12-01",
    timezone: "Europe/Istanbul",
    state: "active",
    kind: "credits",
    booking_mode: "flexible",
    available: 8,
    reserved: 0,
    consumed: 0,
    deficit: 0,
    quotas: [],
    deficit_scopes: [],
  };
  alter = undefined;
  call.mockReset();
  call.mockImplementation(async (op, req) => {
    if (op === "entitlements_get_v1") return [row];
    if (op === "reservation_impact_preview_v1") {
      const p: ReservationProtectionPreview = {
        change: req.change,
        preview: {
          id: previewId,
          token: "synthetic-preview",
          scope_hash: "synthetic",
          dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
          effects: [
            {
              entity: {
                type: req.change.kind === "credit_adjust" ? "entitlement_accounts" : "sales",
                id: req.change.kind === "credit_adjust" ? account : sale,
              },
              action: "adjust",
            },
          ],
          blockers: [],
          expires_at: "2099-01-01T00:00:00Z",
        },
        affected: [],
        preserves_reservations: true,
        waives_independent_blocks: false,
      };
      alter?.(p);
      return p;
    }
    if (op === "credit_adjust_v1" || op === "entitlement_extend_v1")
      return { primary_id: account, changed: [], jobs: [] };
    throw new Error("UNEXPECTED_OPERATION");
  });
});
it("rejects invalid quantities and non-extending dates before creating a capability", async () => {
  for (const quantity of ["", "0", "-2", "1.5", "9007199254740992"])
    await expect(
      previewRightAdjustment(scope, person, sale, "adjust", { ...draft, quantity }),
    ).rejects.toThrow();
  await expect(
    previewRightAdjustment(scope, person, sale, "extend", { ...draft, endDate: row.end_date }),
  ).rejects.toThrow();
  expect(call.mock.calls.some((x) => x[0] === "reservation_impact_preview_v1")).toBe(false);
});
it("rejects a foreign sale, altered quantity or wrong native effect root", async () => {
  alter = (p) => {
    p.change = { kind: "credit_adjust", sale_id: id(99), quantity: 2, direction: "increase" };
  };
  await expect(previewRightAdjustment(scope, person, sale, "adjust", draft)).rejects.toThrow(
    "PROFILE_RIGHT_PREVIEW_UNAVAILABLE",
  );
  alter = (p) => {
    p.change = { kind: "credit_adjust", sale_id: sale, quantity: 99, direction: "increase" };
  };
  await expect(previewRightAdjustment(scope, person, sale, "adjust", draft)).rejects.toThrow(
    "PROFILE_RIGHT_PREVIEW_UNAVAILABLE",
  );
  alter = (p) => {
    p.preview.effects[0]!.entity.id = id(99);
  };
  await expect(previewRightAdjustment(scope, person, sale, "adjust", draft)).rejects.toThrow(
    "PROFILE_RIGHT_PREVIEW_UNAVAILABLE",
  );
  expect(call.mock.calls.some((x) => x[0] === "credit_adjust_v1")).toBe(false);
});
it("keeps credit and extension contracts distinct and freezes their exact source and capability", async () => {
  const adjust = rightAdjustmentIntent(
    await previewRightAdjustment(scope, person, sale, "adjust", draft),
  );
  expect(adjust.operation).toBe("credit_adjust_v1");
  expect(adjust.request).toMatchObject({
    quantity: 2,
    direction: "increase",
    reason: "Synthetic reason",
    sale_id: sale,
    accepted_reservation_ids: [],
    impact_approval: { id: previewId, token: "synthetic-preview" },
  });
  expect(adjust.request).not.toHaveProperty("expected_version");
  const extend = rightAdjustmentIntent(
    await previewRightAdjustment(scope, person, sale, "extend", draft),
  );
  expect(extend.operation).toBe("entitlement_extend_v1");
  expect(extend.request).toMatchObject({ expected_version: 3, end_date: "2026-12-20" });
  expect(extend.request).not.toHaveProperty("quantity");
  row.version = 99;
  await writeRightAdjustment(extend);
  await writeRightAdjustment(extend);
  const writes = call.mock.calls.filter((x) => x[0] === "entitlement_extend_v1");
  expect(writes).toHaveLength(2);
  expect({ ...writes[0]![1], request_id: null }).toEqual({ ...writes[1]![1], request_id: null });
  expect(writes[0]![1].request_id).not.toBe(writes[1]![1].request_id);
  expect(call.mock.calls.some((x) => x[0] === "reservation_impact_apply_v1")).toBe(false);
});
it("requires the exact native account, a newer right version and the reviewed extension date", async () => {
  const intent = rightAdjustmentIntent(
    await previewRightAdjustment(scope, person, sale, "extend", draft),
  );
  await expect(readRightAdjustmentResult(intent, account)).rejects.toThrow(
    "PROFILE_RIGHT_RESULT_UNAVAILABLE",
  );
  row.version = 4;
  await expect(readRightAdjustmentResult(intent, account)).rejects.toThrow(
    "PROFILE_RIGHT_RESULT_UNAVAILABLE",
  );
  row.end_date = "2026-12-20";
  expect((await readRightAdjustmentResult(intent, account)).rights[0]!.end_date).toBe("2026-12-20");
  call.mockResolvedValueOnce({
    operation: intent.operation,
    key: intent.request.operation_key,
    status: "succeeded",
    result_reference: { type: "sales", id: sale },
  });
  await expect(readRightAdjustmentReceipt(intent)).rejects.toThrow(
    "PROFILE_RIGHT_RECEIPT_UNAVAILABLE",
  );
  expect(call.mock.calls.some((x) => x[0] === "entitlement_extend_v1")).toBe(false);
});
