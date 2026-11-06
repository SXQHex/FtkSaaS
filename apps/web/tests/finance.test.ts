import { expect, test } from "vitest";
import type { FinanceView } from "@ftksaas/api-contracts";
import { collectionCommand, financeMatches, validCollection } from "../src/lib/finance";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
const id = "019a2b3c-4d5e-7000-8000-000000000001";
const other = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: id, orgId: other, centerId: id };
const view: FinanceView = {
  person_id: id,
  currency: "TRY",
  credit_available_minor: "0",
  debts: [{ id: other, center_id: id, due_at: "2026-11-06T10:00:00Z", remaining_minor: "240000" }],
  movements: { items: [], as_of: "2026-11-06T10:00:00Z", next_cursor: null },
};
const draft = {
  amount: "1600,50",
  method: "bank_transfer",
  reference: "Banka test referansı",
  localTime: "2026-11-06T13:00",
  timeZone: "Europe/Istanbul",
  offset: "",
  debtIds: [other],
  allocation: "selected",
  note: "Test tahsilatı",
};
test("collection keeps exact minor units, selected debts and center-local timestamp", () => {
  const command = collectionCommand(scope, view, draft);
  expect(command.input).toMatchObject({
    person_id: id,
    currency: "TRY",
    amount_minor: "160050",
    occurred_at: "2026-11-06T10:00:00.000Z",
    debt_ids: [other],
    payment: { method: "bank_transfer", reference: draft.reference },
  });
  expect(
    collectionCommand(scope, view, { ...draft, amount: "90071992547409,93" }).input.amount_minor,
  ).toBe("9007199254740993");
});
test.each([
  { reference: " " },
  { method: "online" },
  { amount: "0" },
  { amount: "1,001" },
  { debtIds: [id] },
  { debtIds: [other, other] },
  { debtIds: [] },
  { localTime: "2026-02-30T13:00" },
])("rejects invalid collection draft %j", (change) => {
  expect(() => collectionCommand(scope, view, { ...draft, ...change })).toThrow(
    /invalidFinance|invalidProduct/,
  );
});
test("automatic allocation is explicit, and a cash reference remains optional", () => {
  const command = collectionCommand(scope, view, {
    ...draft,
    allocation: "automatic",
    debtIds: [],
    method: "cash",
    reference: "",
  });
  expect(command.input.debt_ids).toBeUndefined();
  expect(command.input.payment).toEqual({ method: "cash" });
});
test("DST gaps and ambiguous local time need a real explicit offset", () => {
  expect(() =>
    collectionCommand(scope, view, {
      ...draft,
      timeZone: "Europe/Berlin",
      localTime: "2026-03-29T02:30",
    }),
  ).toThrow(/invalidFinance|invalidProduct/);
  expect(() =>
    collectionCommand(scope, view, {
      ...draft,
      timeZone: "Europe/Berlin",
      localTime: "2026-10-25T02:30",
    }),
  ).toThrow(/invalidFinance|invalidProduct/);
  expect(
    collectionCommand(scope, view, {
      ...draft,
      timeZone: "Europe/Berlin",
      localTime: "2026-10-25T02:30",
      offset: "2026-10-25T01:30:00.000Z",
    }).input.occurred_at,
  ).toBe("2026-10-25T01:30:00.000Z");
});
test("finance projections reject another person, currency, center or malformed money", () => {
  expect(financeMatches(view, id, "TRY", id)).toBe(true);
  for (const changed of [
    { ...view, person_id: other },
    { ...view, currency: "EUR" },
    { ...view, debts: [{ ...view.debts[0]!, center_id: other }] },
    { ...view, credit_available_minor: "1.5" },
    {
      ...view,
      movements: {
        ...view.movements,
        items: [
          {
            id,
            kind: "collection" as const,
            amount_minor: "1",
            currency: "EUR",
            occurred_at: view.movements.as_of,
          },
        ],
      },
    },
  ])
    expect(financeMatches(changed, id, "TRY", id)).toBe(false);
});
test("recovery binds finance payload to the person slot and rejects unexpected fields", () => {
  const command = collectionCommand(scope, view, draft);
  const key = setupStorageKey(scope, `finance:${id}`);
  sessionStorage.setItem(key, JSON.stringify({ command }));
  expect(recoverSetup(scope, `finance:${id}`)).toEqual({ command });
  sessionStorage.setItem(setupStorageKey(scope, `finance:${other}`), JSON.stringify({ command }));
  expect(recoverSetup(scope, `finance:${other}`)).toBe("invalid");
  expect(
    validCollection({ ...command.input, payment: { method: "cash", secret: "unexpected" } }, id),
  ).toBe(false);
});
test("finance recovery rejects commands from a different operation family", () => {
  sessionStorage.setItem(
    setupStorageKey(scope, `finance:${id}`),
    JSON.stringify({
      command: {
        operation: "sale_apply_v1",
        input: {
          org_id: scope.orgId,
          center_id: scope.centerId,
          operation_key: other,
          preview: { id, token: "synthetic" },
        },
      },
    }),
  );
  expect(recoverSetup(scope, `finance:${id}`)).toBe("invalid");
});
test("collection recovery requires a string payment method", () => {
  const command = collectionCommand(scope, view, draft);
  expect(
    validCollection(
      { ...command.input, payment: { method: ["bank_transfer"], reference: "test" } },
      id,
    ),
  ).toBe(false);
});
