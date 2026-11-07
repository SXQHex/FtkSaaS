import { expect, test } from "vitest";
import { lifecycleMatches, lifecycleCommand } from "../src/lib/sale-lifecycle";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
import type { Preview } from "@ftksaas/api-contracts";
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  person = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: id, orgId: id, centerId: id };
const preview: Preview = {
  id,
  token: "synthetic",
  scope_hash: "scope",
  expires_at: "2099-01-01T00:00:00Z",
  effects: [],
  blockers: [],
  dependencies: {
    versions: [{ entity: { type: "sales", id }, version: 3 }],
    policy_hashes: [],
    permission_hash: "perm",
  },
};
test("lifecycle preview requires the actual source sale and a live proof", () => {
  expect(lifecycleMatches(preview, id)).toBe(true);
  expect(lifecycleMatches(preview, person)).toBe(false);
  expect(lifecycleMatches({ ...preview, expires_at: "2000-01-01T00:00:00Z" }, id)).toBe(false);
});
test.each(["freeze", "freeze_end", "terminate"] as const)(
  "%s journal retains the exact approved proof and rejects another command family",
  (kind) => {
    const command = lifecycleCommand(scope, kind, preview);
    const slot = `sale-lifecycle:${person}`;
    sessionStorage.setItem(setupStorageKey(scope, slot), JSON.stringify({ command }));
    expect(recoverSetup(scope, slot)).toEqual({ command });
    sessionStorage.setItem(
      setupStorageKey(scope, slot),
      JSON.stringify({ command: { ...command, input: { ...command.input, unexpected: true } } }),
    );
    expect(recoverSetup(scope, slot)).toBe("invalid");
    sessionStorage.removeItem(setupStorageKey(scope, slot));
  },
);
