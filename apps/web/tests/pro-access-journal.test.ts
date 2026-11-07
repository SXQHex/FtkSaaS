import { beforeEach, expect, test } from "vitest";
import { v7 } from "uuid";
import { recoverSetup, setupStorageKey, type SetupScope } from "../src/lib/studio-setup";
import { discoverPendingOperations } from "../src/lib/pending-operations";
const scope = { actorId: v7(), orgId: v7() },
  center = v7(),
  target = v7(),
  person = v7();
beforeEach(() => sessionStorage.clear());
function save(
  context: SetupScope,
  slot: string,
  operation: string,
  input: Record<string, unknown>,
) {
  const record = {
    command: {
      operation,
      input: { org_id: context.orgId, operation_key: v7(), expected_version: 6, ...input },
    },
  };
  sessionStorage.setItem(setupStorageKey(context, slot), JSON.stringify(record));
  return record;
}
test("organization plan requests recover without center catalog and cannot cross slots, centers or target IDs", () => {
  const slot = `subscription-downgrade:${target}`;
  const record = save(scope, slot, "subscription_downgrade_request_v1", {
    target_plan_id: target,
    kept_center_id: center,
    kept_scope: {
      room_id: null,
      discipline_id: null,
      instructor_id: null,
      student_person_ids: [person],
    },
  });
  expect(recoverSetup(scope, slot)).toEqual(record);
  expect(discoverPendingOperations(scope.actorId)).toEqual([{ scope, slot, kind: "access" }]);
  save(scope, slot, "subscription_downgrade_request_v1", { target_plan_id: v7() });
  expect(recoverSetup(scope, slot)).toBe("invalid");
  save({ ...scope, centerId: center }, slot, "subscription_downgrade_request_v1", {
    target_plan_id: target,
  });
  expect(recoverSetup({ ...scope, centerId: center }, slot)).toBe("invalid");
});
test.each([
  { expected_version: 0 },
  { expected_version: 1.5 },
  { center_id: center },
  { unexpected: true },
  {
    kept_scope: {
      room_id: null,
      discipline_id: null,
      instructor_id: null,
      student_person_ids: [person, person],
    },
  },
  {
    kept_scope: {
      room_id: null,
      discipline_id: null,
      instructor_id: null,
      student_person_ids: [],
      extra: true,
    },
  },
])("plan recovery rejects malformed or foreign fields: %j", (extra) => {
  const slot = `subscription-downgrade:${target}`;
  save(scope, slot, "subscription_downgrade_request_v1", { target_plan_id: target, ...extra });
  expect(recoverSetup(scope, slot)).toBe("invalid");
});
test("cancellation is bound to its own pending change and cannot replay as a downgrade", () => {
  const slot = `subscription-cancel:${target}`;
  const record = save(scope, slot, "subscription_change_cancel_v1", { change_id: target });
  expect(recoverSetup(scope, slot)).toEqual(record);
  save(scope, slot, "subscription_downgrade_request_v1", { target_plan_id: target });
  expect(recoverSetup(scope, slot)).toBe("invalid");
});
test("permission recovery preserves explicit false in exact actor/org/center/person/permission scope", () => {
  const context = { ...scope, centerId: center },
    slot = `permission:${person}:sale.write`;
  const record = save(context, slot, "permission_set_v1", {
    center_id: center,
    person_id: person,
    permission: "sale.write",
    enabled: false,
  });
  expect(recoverSetup(context, slot)).toEqual(record);
  expect(discoverPendingOperations(scope.actorId)).toEqual([
    { scope: context, slot, kind: "access" },
  ]);
  expect(discoverPendingOperations(v7())).toEqual([]);
  save(context, slot, "permission_set_v1", {
    center_id: center,
    person_id: person,
    permission: "finance.collect",
    enabled: false,
  });
  expect(recoverSetup(context, slot)).toBe("invalid");
  save(context, slot, "permission_set_v1", {
    center_id: v7(),
    person_id: person,
    permission: "sale.write",
    enabled: false,
  });
  expect(recoverSetup(context, slot)).toBe("invalid");
});
