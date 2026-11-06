import { expect, test } from "vitest";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import { valuationVersion, validValuationCommand } from "../src/lib/negative-valuation";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
import { discoverPendingOperations } from "../src/lib/pending-operations";
const center = "019a2b3c-4d5e-7000-8000-000000000001",
  discipline = "019a2b3c-4d5e-7000-8000-000000000002";
const row: ManagementStateView = {
  operation: "negcredit_valuation_set_v1",
  entity: { type: "centers", id: center },
  exists: false,
  state: null,
  versions: [{ entity: { type: "centers", id: center }, version: 7 }],
  as_of: "2030-01-01T00:00:00Z",
  current: { operation: "negcredit_valuation_set_v1", values: {} },
};
test("an absent valuation still uses its real center write-version", () => {
  expect(valuationVersion([row], center, discipline, "group")).toEqual({
    version: 7,
    current: null,
  });
  expect(() => valuationVersion([row], discipline, discipline, "group")).toThrow(
    "invalidValuation",
  );
  expect(() => valuationVersion([{ ...row, versions: [] }], center, discipline, "group")).toThrow(
    "invalidValuation",
  );
});
test("an existing valuation must match discipline, format, currency and effective instant", () => {
  const existing: ManagementStateView = {
    ...row,
    exists: true,
    state: "active",
    current: {
      operation: "negcredit_valuation_set_v1",
      values: {
        discipline_id: discipline,
        format: "group",
        currency: "TRY",
        amount_minor: "0",
        effective_at: "2030-01-01T00:00:00Z",
      },
    },
  };
  expect(valuationVersion([existing], center, discipline, "group").version).toBe(7);
  expect(() => valuationVersion([existing], center, discipline, "private")).toThrow(
    "invalidValuation",
  );
  expect(() =>
    valuationVersion(
      [
        {
          ...existing,
          current: {
            operation: "negcredit_valuation_set_v1",
            values: {
              discipline_id: discipline,
              format: "group",
              currency: "TRY",
              amount_minor: "0",
              effective_at: "invalid",
            },
          },
        },
      ],
      center,
      discipline,
      "group",
    ),
  ).toThrow("invalidValuation");
});
test("valuation journal and global recovery keep the exact scoped version and zero amount", () => {
  const scope = { actorId: center, orgId: center, centerId: center },
    slot = `valuation-group:${discipline}`;
  const input = {
    org_id: center,
    center_id: center,
    operation_key: discipline,
    discipline_id: discipline,
    format: "group" as const,
    expected_version: 7,
    amount_minor: "0",
    currency: "TRY",
    effective_at: "2030-01-01T00:00:00Z",
  };
  expect(validValuationCommand(input, center, slot)).toBe(true);
  expect(validValuationCommand({ ...input, expected_version: 0 }, center, slot)).toBe(false);
  const command = { operation: "negcredit_valuation_set_v1", input };
  sessionStorage.setItem(setupStorageKey(scope, slot), JSON.stringify({ command }));
  expect(recoverSetup(scope, slot)).toEqual({ command });
  expect(discoverPendingOperations(center)).toContainEqual({ scope, slot, kind: "settings" });
  sessionStorage.clear();
});
