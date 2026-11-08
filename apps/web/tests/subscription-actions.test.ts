import { test, expect } from "vitest";
import { v7 } from "uuid";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
const scope = { actorId: v7(), orgId: v7() },
  target = v7();
function restore(slot: string, operation: string, input: object) {
  sessionStorage.setItem(
    setupStorageKey(scope, slot),
    JSON.stringify({
      command: { operation, input: { org_id: scope.orgId, operation_key: v7(), ...input } },
    }),
  );
  return recoverSetup(scope, slot);
}
test("period changes recover exact accepted terms and reject a different target slot", () => {
  const input = {
    target_plan_id: target,
    expected_version: 3,
    amount_minor: "1200000",
    currency: "TRY",
    effective_at: "2030-01-01T00:00:00Z",
  };
  expect(
    restore(`subscription-period:${target}`, "subscription_period_change_request_v1", input),
  ).not.toBe("invalid");
  expect(
    restore(`subscription-period:${v7()}`, "subscription_period_change_request_v1", input),
  ).toBe("invalid");
});
test("renewal recovery requires boolean choice and the live subscription version", () => {
  expect(
    restore("subscription-renewal", "subscription_renewal_set_v1", {
      expected_version: 3,
      renew: false,
    }),
  ).not.toBe("invalid");
  expect(
    restore("subscription-renewal", "subscription_renewal_set_v1", {
      expected_version: 0,
      renew: true,
    }),
  ).toBe("invalid");
});
test("organization deletion persists the approved intent without accepting a stored reauth credential", () => {
  const input = { preview: { id: v7(), token: "synthetic" }, all_data: true };
  expect(restore("organization-delete", "organization_delete_apply_v1", input)).not.toBe("invalid");
  expect(
    restore("organization-delete", "organization_delete_apply_v1", {
      ...input,
      reauth: "credential",
    }),
  ).toBe("invalid");
});
