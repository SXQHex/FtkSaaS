import type { PayTerms } from "@ftksaas/api-contracts";
import { expect, test } from "vitest";
import {
  agreementCommand,
  validPayTerms,
  payTerms,
  emptyPayDraft,
} from "../src/lib/agreement-command";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  other = "019a2b3c-4d5e-7000-8000-000000000002",
  scope = { actorId: id, orgId: id, centerId: other };
const terms: PayTerms = {
  model: "session_fixed" as const,
  currency: "TRY",
  components: [{ kind: "session_fixed" as const, amount_minor: "120050" }],
  room_fee: { kind: "free" as const, order: "before_instructor_share" as const },
};
const draft = {
  disciplineId: id,
  format: "group",
  starts: "2027-01-01T13:00",
  ends: "2027-02-01T13:00",
  startOffset: "",
  endOffset: "",
  reason: "Yeni ücret anlaşması",
};
test("agreement creates exact scoped terms and real instants, without an invented predecessor version", () => {
  const result = agreementCommand(scope, id, "Europe/Istanbul", draft, terms);
  expect(result.input).toMatchObject({
    person_id: id,
    discipline_id: id,
    valid: { starts_at: "2027-01-01T10:00:00.000Z", ends_at: "2027-02-01T10:00:00.000Z" },
    terms,
  });
  expect(result.input).not.toHaveProperty("expected_version");
});
test("pay terms require explicit choices and never silently select a free room or currency", () => {
  expect(() => payTerms(emptyPayDraft())).toThrow("invalidAgreement");
  expect(validPayTerms(terms)).toBe(true);
  expect(validPayTerms({ ...terms, room_fee: { kind: "free" } })).toBe(false);
  expect(
    validPayTerms({
      ...terms,
      components: [{ kind: "session_fixed", amount_minor: "1", rate_bps: 50 }],
    }),
  ).toBe(false);
});
test("agreement recovery is exact to person and center and rejects extra terms fields", () => {
  const command = agreementCommand(scope, id, "UTC", draft, terms),
    slot = `agreements:${id}`;
  sessionStorage.clear();
  sessionStorage.setItem(setupStorageKey(scope, slot), JSON.stringify({ command }));
  expect(recoverSetup(scope, slot)).toEqual({ command });
  sessionStorage.setItem(
    setupStorageKey(scope, `agreements:${other}`),
    JSON.stringify({ command }),
  );
  expect(recoverSetup(scope, `agreements:${other}`)).toBe("invalid");
  sessionStorage.setItem(
    setupStorageKey(scope, slot),
    JSON.stringify({
      command: { ...command, input: { ...command.input, terms: { ...terms, unexpected: true } } },
    }),
  );
  expect(recoverSetup(scope, slot)).toBe("invalid");
});

test.each(["percentage", "per_person", "fixed_plus_person", "explicit_mixed"])(
  "%s terms preserve explicit exact amounts, valuation and entitlement",
  (model) => {
    const d = emptyPayDraft();
    d.model = model;
    d.currency = "KWD";
    d.room = {
      kind: "percentage",
      amount: "",
      rate: "12,35",
      basis: "fixed_unit",
      unit: "15.125",
      order: "after_instructor_share",
    };
    const variable = {
      kind: model === "percentage" ? "percentage" : "per_person",
      amount: "2.125",
      rate: "33.33",
      entitlement: "timed",
      basis: "fixed_unit",
      unit: "10.125",
    };
    d.components =
      model === "fixed_plus_person"
        ? [{ ...variable, kind: "session_fixed", amount: "20.125" }, variable]
        : [variable];
    const result = payTerms(d);
    expect(result.room_fee).toEqual({
      kind: "percentage",
      rate_bps: 1235,
      basis: { mode: "fixed_unit", unit_minor: "15125" },
      order: "after_instructor_share",
    });
    expect(result.components.at(-1)).toEqual(
      model === "percentage"
        ? {
            kind: "percentage",
            rate_bps: 3333,
            entitlement_kind: "timed",
            basis: { mode: "fixed_unit", unit_minor: "10125" },
          }
        : { kind: "per_person", amount_minor: "2125", entitlement_kind: "timed" },
    );
  },
);
test("terms reject overlapping components, unsupported precision, timed sale valuation and fixed package fees", () => {
  const percentage = { kind: "percentage", rate_bps: 5000, basis: { mode: "sale_unit" } };
  expect(
    validPayTerms({
      ...terms,
      model: "percentage",
      components: [{ ...percentage, entitlement_kind: "timed" }],
    }),
  ).toBe(false);
  expect(
    validPayTerms({
      ...terms,
      model: "explicit_mixed",
      components: [percentage, { ...percentage, entitlement_kind: "credits" }],
    }),
  ).toBe(false);
  expect(
    validPayTerms({
      ...terms,
      package_overrides: [{ product_id: id, components: terms.components }],
    }),
  ).toBe(false);
  const d = emptyPayDraft();
  d.model = "percentage";
  d.currency = "JPY";
  d.components = [
    {
      kind: "percentage",
      rate: "12.345",
      amount: "",
      entitlement: "all",
      basis: "sale_unit",
      unit: "",
    },
  ];
  d.room = {
    kind: "free",
    amount: "",
    rate: "",
    basis: "",
    unit: "",
    order: "before_instructor_share",
  };
  expect(() => payTerms(d)).toThrow("invalidAgreement");
  d.components[0].rate = "100.01";
  expect(() => payTerms(d)).toThrow("invalidAgreement");
  d.components[0].rate = "100";
  expect(payTerms(d).components[0].rate_bps).toBe(10000);
});
test("new versions require the actual matching chain and a later valid instant", () => {
  const prior = {
    id: other,
    version: 9,
    person_id: id,
    center_id: other,
    discipline_id: id,
    format: "group" as const,
    valid: { starts_at: "2026-01-01T00:00:00Z", ends_at: null },
    supersedes_id: null,
    published_at: null,
    terms,
  };
  expect(agreementCommand(scope, id, "UTC", draft, terms, prior).input).toMatchObject({
    supersedes_id: other,
    expected_version: 9,
  });
  for (const changed of [
    { person_id: other },
    { center_id: id },
    { discipline_id: other },
    { format: "private" as const },
    { version: 0 },
    { valid: { starts_at: "2027-01-01T13:00:00Z", ends_at: null } },
  ])
    expect(() =>
      agreementCommand(scope, id, "UTC", draft, terms, { ...prior, ...changed }),
    ).toThrow("invalidAgreement");
  expect(() =>
    agreementCommand(
      scope,
      id,
      "Europe/Berlin",
      { ...draft, starts: "2027-03-28T02:30", ends: "2027-03-28T04:00" },
      terms,
    ),
  ).toThrow("invalidAgreement");
  expect(() =>
    agreementCommand(
      scope,
      id,
      "Europe/Berlin",
      { ...draft, starts: "2027-10-31T02:30", ends: "2027-10-31T04:00" },
      terms,
    ),
  ).toThrow("invalidAgreement");
});
test("recovery rejects missing replacement versions, another write family and nested unrelated fields", () => {
  const command = agreementCommand(scope, id, "UTC", draft, terms),
    slot = `agreements:${id}`;
  for (const input of [
    { ...command.input, supersedes_id: other },
    { ...command.input, expected_version: 9 },
    { ...command.input, valid: { ...command.input.valid, unexpected: true } },
    { ...command.input, terms: { ...terms, room_fee: { ...terms.room_fee, rate_bps: 1 } } },
  ]) {
    sessionStorage.setItem(
      setupStorageKey(scope, slot),
      JSON.stringify({ command: { ...command, input } }),
    );
    expect(recoverSetup(scope, slot)).toBe("invalid");
  }
  sessionStorage.setItem(setupStorageKey(scope, `rights:${id}`), JSON.stringify({ command }));
  expect(recoverSetup(scope, `rights:${id}`)).toBe("invalid");
});

test.each(["staff", "assistant"])(
  "the existing assign journal preserves a legitimate %s write across reload",
  (role) => {
    const command = {
      operation: "role_assign_v1",
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        person_id: id,
        operation_key: other,
        role,
        scope: { center_id: scope.centerId },
      },
    };
    sessionStorage.setItem(setupStorageKey(scope, "assign"), JSON.stringify({ command }));
    expect(recoverSetup(scope, "assign")).toEqual({ command });
    sessionStorage.setItem(
      setupStorageKey(scope, "assign"),
      JSON.stringify({
        command: { ...command, input: { ...command.input, scope: { center_id: id } } },
      }),
    );
    expect(recoverSetup(scope, "assign")).toBe("invalid");
  },
);
