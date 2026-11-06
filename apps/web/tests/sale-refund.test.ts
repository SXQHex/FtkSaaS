import { expect, test } from "vitest";
import { saleRefundCommand, refundMatches } from "../src/lib/sale-refund";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
import { discoverPendingOperations } from "../src/lib/pending-operations";
import type { Preview } from "@ftksaas/api-contracts";
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  other = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: id, orgId: other, centerId: id };
const preview: Preview = {
  id,
  token: "synthetic",
  scope_hash: "synthetic",
  expires_at: "2099-01-01T00:00:00Z",
  effects: [],
  blockers: [],
  dependencies: {
    versions: [{ entity: { type: "sales", id: other }, version: 3 }],
    policy_hashes: [],
    permission_hash: "synthetic",
  },
};
test("sale refund preview must depend on the actual selected source sale", () => {
  expect(refundMatches(preview, other)).toBe(true);
  expect(refundMatches(preview, id)).toBe(false);
  expect(
    refundMatches({ ...preview, dependencies: { ...preview.dependencies, versions: [] } }, other),
  ).toBe(false);
});
test("sale refund journal uses an exact scoped preview and a separate financial family", () => {
  sessionStorage.clear();
  const command = saleRefundCommand(scope, preview),
    slot = `sale-refund:${other}`;
  sessionStorage.setItem(setupStorageKey(scope, slot), JSON.stringify({ command }));
  expect(recoverSetup(scope, slot)).toEqual({ command });
  expect(discoverPendingOperations(id)).toEqual([{ scope, slot, kind: "finance" }]);
  for (const wrong of [`finance:${id}`, `collection-correct:${other}`, `sale-renew:${id}`]) {
    sessionStorage.setItem(setupStorageKey(scope, wrong), JSON.stringify({ command }));
    expect(recoverSetup(scope, wrong)).toBe("invalid");
  }
  sessionStorage.clear();
});
