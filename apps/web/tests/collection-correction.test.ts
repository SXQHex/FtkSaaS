import { expect, test } from "vitest";
import { correctionInput, correctionCommand } from "../src/lib/collection-correction";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
import { discoverPendingOperations } from "../src/lib/pending-operations";
const id = "019a2b3c-4d5e-7000-8000-000000000001";
const other = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: id, orgId: other, centerId: id };
const movement = {
  id: other,
  kind: "collection" as const,
  amount_minor: "160000",
  currency: "TRY",
  occurred_at: "2026-11-06T10:00:00Z",
};
const draft = {
  amount: "120,50",
  direction: "decrease",
  reason: "Fazla kaydedilmiş tutar",
  localTime: "2026-11-06T13:00",
  timeZone: "Europe/Istanbul",
  offset: "",
};
test("correction sends a directed delta, not the replacement total", () => {
  expect(correctionInput(scope, movement, draft)).toEqual({
    org_id: other,
    center_id: id,
    cash_movement_id: other,
    reason: draft.reason,
    correction: {
      amount_minor: "12050",
      direction: "decrease",
      currency: "TRY",
      occurred_at: "2026-11-06T10:00:00.000Z",
    },
  });
});
test.each([
  { amount: "0" },
  { amount: "-1" },
  { direction: "replace" },
  { reason: " " },
  { localTime: "2026-03-29T02:30", timeZone: "Europe/Berlin" },
])("invalid correction is rejected: %j", (change) => {
  expect(() => correctionInput(scope, movement, { ...draft, ...change })).toThrow(
    /invalidFinance|invalidProduct/,
  );
});
test("foreign-center and non-collection movements cannot be corrected", () => {
  expect(() => correctionInput(scope, { ...movement, center_id: other }, draft)).toThrow(
    /invalidFinance|invalidProduct/,
  );
  expect(() => correctionInput(scope, { ...movement, kind: "refund" }, draft)).toThrow(
    /invalidFinance|invalidProduct/,
  );
});
test("correction journal is discoverable only in its own command family", () => {
  sessionStorage.clear();
  const command = correctionCommand(scope, { id, token: "synthetic-preview" });
  const slot = `collection-correct:${other}`;
  sessionStorage.setItem(setupStorageKey(scope, slot), JSON.stringify({ command }));
  expect(recoverSetup(scope, slot)).toEqual({ command });
  expect(discoverPendingOperations(id)).toEqual([{ scope, slot, kind: "finance" }]);
  sessionStorage.setItem(setupStorageKey(scope, `finance:${other}`), JSON.stringify({ command }));
  expect(recoverSetup(scope, `finance:${other}`)).toBe("invalid");
  sessionStorage.setItem(
    setupStorageKey(scope, slot),
    JSON.stringify({
      command: { ...command, input: { ...command.input, preview: { id, token: "" } } },
    }),
  );
  expect(recoverSetup(scope, slot)).toBe("invalid");
  sessionStorage.clear();
});
