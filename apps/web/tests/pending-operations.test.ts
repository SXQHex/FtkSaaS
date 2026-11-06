import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { discoverPendingOperations } from "../src/lib/pending-operations";
import { setupStorageKey } from "../src/lib/studio-setup";
const actorId = "019a2b3c-4d5e-7000-8000-000000000001";
const scope = {
  actorId,
  orgId: "019a2b3c-4d5e-7000-8000-000000000002",
  centerId: "019a2b3c-4d5e-7000-8000-000000000003",
};
const target = "019a2b3c-4d5e-7000-8000-000000000004";
const sale = {
  command: {
    operation: "sale_apply_v1",
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: target,
      preview: { id: target, token: "synthetic-preview" },
    },
  },
};
beforeEach(() => sessionStorage.clear());
function seed(slot = `sale-renew:${target}`, value: unknown = sale, context = scope) {
  sessionStorage.setItem(setupStorageKey(context, slot), JSON.stringify(value));
}
test("finds the actor's pending sale without an organization or center catalog", () => {
  seed();
  expect(discoverPendingOperations(actorId)).toEqual([
    { scope, slot: `sale-renew:${target}`, kind: "sale" },
  ]);
});
test("foreign actors, malformed scopes, unrelated slots and mismatched command families are excluded", () => {
  seed();
  seed(`sale-renew:${target}`, sale, { ...scope, actorId: target });
  seed(`sale-renew:${target}`, sale, { ...scope, orgId: "invalid" });
  seed("product-publish", sale);
  seed(`rights:${target}`, sale);
  expect(discoverPendingOperations(actorId)).toHaveLength(1);
  expect(discoverPendingOperations("019a2b3c-4d5e-7000-8000-000000000099")).toEqual([]);
});
test("corrupt recognized records remain visible for safe feedback while unknown slots are ignored", () => {
  seed(`sale-renew:${target}`, { broken: true });
  seed("unknown", { broken: true });
  expect(discoverPendingOperations(actorId)).toEqual([
    { scope, slot: `sale-renew:${target}`, kind: "sale" },
  ]);
});
test("a reservation retains its exact saved session and center rather than current navigation context", () => {
  const slot = `bookings:${target}`;
  seed(slot, {
    command: {
      operation: "reservation_create_v1",
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation_key: target,
        person_id: target,
        session_id: target,
        source_sale_id: target,
        mode: "flexible",
      },
    },
  });
  expect(discoverPendingOperations(actorId)).toEqual([{ scope, slot, kind: "reservation" }]);
});

test("lesson requests and rights keep their own operation families", () => {
  seed("lesson-requests", {
    command: {
      operation: "lesson_request_withdraw_v1",
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation_key: target,
        lesson_request_id: target,
        expected_version: 1,
      },
    },
  });
  seed(`rights:${target}`, {
    command: {
      operation: "credit_adjust_v1",
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation_key: target,
        sale_id: target,
        quantity: 1,
        direction: "increase",
        reason: "Synthetic",
        impact_approval: { id: target, token: "synthetic" },
        accepted_reservation_ids: [],
      },
    },
  });
  expect(
    discoverPendingOperations(actorId)
      ?.map((item) => item.kind)
      .sort(),
  ).toEqual(["request", "rights"]);
});

afterEach(() => vi.restoreAllMocks());
test("unreadable storage is reported rather than an empty successful discovery", () => {
  seed();
  vi.spyOn(Storage.prototype, "key").mockImplementationOnce(() => {
    throw Error("blocked");
  });
  expect(discoverPendingOperations(actorId)).toBeNull();
});
