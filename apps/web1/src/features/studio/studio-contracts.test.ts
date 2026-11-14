import { afterEach, describe, expect, it, vi } from "vitest";
import {
  availabilityDraft,
  availabilityIntent,
  availabilityPeriod,
  type AvailabilityBase,
} from "./availability-edit";
import { agreementDraft, agreementIntent, payTerms, termsDraft } from "./agreement";
import { closureIntent, ClosureTimeError, type ClosureContext } from "./closure";
import type { AgreementVersionView } from "../../lib/api-contracts/generated";

const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000002",
  orgId: "019a7b00-0000-7000-8000-000000000003",
  centerId: "019a7b00-0000-7000-8000-000000000004",
};
const person = "019a7b00-0000-7000-8000-000000000006",
  discipline = "019a7b00-0000-7000-8000-000000000009";
const base: AvailabilityBase = {
  scope,
  personId: person,
  records: [
    {
      id: "019a7b00-0000-7000-8000-000000000011",
      version: 3,
      rule: {
        weekdays: [1, 3],
        local_start: "18:00:00",
        local_end: "21:00:00",
        valid_from: "2026-11-01",
        valid_until: null,
      },
    },
  ],
};
const agreement: AgreementVersionView = {
  id: "019a7b00-0000-7000-8000-000000000012",
  version: 7,
  person_id: person,
  center_id: scope.centerId,
  discipline_id: discipline,
  format: "group",
  valid: { starts_at: "2026-11-01T00:00:00Z", ends_at: null },
  published_at: "2026-11-01T00:00:00Z",
  supersedes_id: null,
  terms: {
    model: "session_fixed",
    currency: "TRY",
    components: [{ kind: "session_fixed", amount_minor: "12550" }],
    room_fee: { kind: "free", order: "after_instructor_share" },
  },
};
const closureContext = (timezone: string): ClosureContext => ({
  scope,
  center: {
    id: scope.centerId,
    name: "Fixture",
    accessible: true,
    state: "active",
    version: 9,
    timezone,
  },
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("availability contract boundaries", () => {
  it("splits a changed weekday without overwriting an unchanged day or sharing keys", () => {
    const draft = availabilityDraft(base.records);
    draft.days[0]!.intervals[0]!.from = "19:00";
    const intent = availabilityIntent(base, availabilityPeriod(base.records[0]!), draft);
    expect(intent.steps).toHaveLength(2);
    expect(intent.steps[0]).toMatchObject({
      id: base.records[0]!.id,
      version: 3,
      rule: { weekdays: [3], local_start: "18:00:00" },
    });
    expect(intent.steps[1]).toMatchObject({ rule: { weekdays: [1], local_start: "19:00:00" } });
    expect(intent.steps[1]!.id).toBeUndefined();
    expect(intent.steps[1]!.version).toBeUndefined();
    expect(new Set(intent.steps.map((step) => step.key)).size).toBe(2);
    expect(base.records[0]!.rule.weekdays).toEqual([1, 3]);
  });
  it("rejects retirement of the last weekday before constructing any write", () => {
    const draft = availabilityDraft(base.records);
    draft.days.forEach((day) => {
      day.enabled = false;
    });
    expect(() => availabilityIntent(base, availabilityPeriod(base.records[0]!), draft)).toThrow(
      "AVAILABILITY_REMOVE_UNSUPPORTED",
    );
  });
  it("preserves 24:00 and ignores unfinished values on disabled draft days", () => {
    const draft = availabilityDraft([]);
    draft.validFrom = "2026-11-01";
    draft.days[0] = { enabled: true, intervals: [{ id: 1, from: "23:30", to: "24:00" }] };
    draft.days[1] = { enabled: false, intervals: [{ id: 2, from: "", to: "" }] };
    const intent = availabilityIntent({ ...base, records: [] }, "new", draft);
    expect(intent.steps).toHaveLength(1);
    expect(intent.steps[0]!.rule).toEqual({
      weekdays: [1],
      local_start: "23:30:00",
      local_end: "24:00:00",
      valid_from: "2026-11-01",
      valid_until: null,
    });
  });
  it("does not touch another validity period and does not create no-op writes", () => {
    const other = {
      ...base.records[0]!,
      id: "019a7b00-0000-7000-8000-000000000013",
      rule: { ...base.records[0]!.rule, valid_from: "2030-01-01" },
    };
    const intent = availabilityIntent(
      { ...base, records: [...base.records, other] },
      availabilityPeriod(base.records[0]!),
      availabilityDraft(base.records),
    );
    expect(intent.steps).toEqual([]);
  });
  it("rejects same-day/reversed validity and overnight rules instead of shifting them", () => {
    const draft = availabilityDraft(base.records);
    draft.validUntil = draft.validFrom;
    expect(() => availabilityIntent(base, availabilityPeriod(base.records[0]!), draft)).toThrow(
      "AVAILABILITY_INVALID",
    );
    draft.validUntil = "";
    draft.days[0]!.intervals[0] = { id: base.records[0]!.id, from: "23:00", to: "01:00" };
    expect(() => availabilityIntent(base, availabilityPeriod(base.records[0]!), draft)).toThrow(
      "AVAILABILITY_INVALID",
    );
  });
});

describe("immutable agreement contract", () => {
  it("keeps int64 amounts exact above JS safe integer and rejects overflow", () => {
    const draft = termsDraft(agreement.terms);
    draft.components[0]!.amount = "9223372036854775807";
    expect(payTerms(draft).components[0]!.amount_minor).toBe("9223372036854775807");
    draft.components[0]!.amount = "9223372036854775808";
    expect(() => payTerms(draft)).toThrow();
  });
  it("converts a comma percentage without rounding and requires a timed fixed basis", () => {
    const draft = termsDraft(agreement.terms);
    draft.model = "percentage";
    draft.components[0] = {
      ...draft.components[0]!,
      kind: "percentage",
      rate: "12,35",
      entitlement: "timed",
      basis: "sale_unit",
    };
    expect(() => payTerms(draft)).toThrow("AGREEMENT_INVALID");
    draft.components[0]!.basis = "fixed_unit";
    draft.components[0]!.unit = "12345";
    expect(payTerms(draft).components[0]).toEqual({
      kind: "percentage",
      rate_bps: 1235,
      entitlement_kind: "timed",
      basis: { mode: "fixed_unit", unit_minor: "12345" },
    });
    draft.components[0]!.rate = "12.345";
    expect(() => payTerms(draft)).toThrow("AGREEMENT_INVALID");
    draft.components[0]!.rate = "100.01";
    expect(() => payTerms(draft)).toThrow("AGREEMENT_INVALID");
  });
  it("rejects a package fixed session fee and overlapping variable components", () => {
    const draft = termsDraft(agreement.terms);
    draft.overrides = [
      { key: "package", productId: discipline, components: [...draft.components] },
    ];
    expect(() => payTerms(draft)).toThrow("AGREEMENT_INVALID");
    draft.overrides = [];
    draft.model = "per_person";
    const row = { ...draft.components[0]!, kind: "per_person", entitlement: "all" };
    draft.components = [row, { ...row, key: "second", entitlement: "credits" }];
    expect(() => payTerms(draft)).toThrow("AGREEMENT_INVALID");
  });
  it("binds a replacement to its exact predecessor and interprets input explicitly as UTC", async () => {
    vi.stubEnv("TZ", "Pacific/Honolulu");
    const draft = await agreementDraft(agreement);
    Object.assign(draft, {
      from: "2027-03-14T02:30:00",
      until: "2028-03-14T02:30:00",
      reason: "Fixture replacement",
      accepted: true,
    });
    const intent = await agreementIntent(scope, draft, agreement);
    expect(intent.payload).toMatchObject({
      supersedes_id: agreement.id,
      expected_version: 7,
      valid: { starts_at: "2027-03-14T02:30:00Z", ends_at: "2028-03-14T02:30:00Z" },
    });
    const fresh = await agreementIntent(scope, draft);
    expect(fresh.payload).not.toHaveProperty("supersedes_id");
    expect(fresh.payload).not.toHaveProperty("expected_version");
    await expect(
      agreementIntent({ ...scope, centerId: discipline }, draft, agreement),
    ).rejects.toThrow("AGREEMENT_CHANGED");
    await expect(agreementIntent(scope, { ...draft, accepted: false }, agreement)).rejects.toThrow(
      "AGREEMENT_APPROVAL_REQUIRED",
    );
  });
});

describe("closure calendar/instant boundaries", () => {
  const draft = {
    kind: "room" as const,
    target: discipline,
    from: "2025-03-09",
    to: "2025-03-09",
    reason: "Fixture closure",
    startOffset: "",
    endOffset: "",
  };
  it("uses calendar days across a 23-hour DST day, with a local Temporal fallback", async () => {
    vi.stubGlobal("Temporal", undefined);
    const intent = await closureIntent(closureContext("America/New_York"), draft);
    expect(intent.version).toBe(9);
    expect(intent.interval).toEqual({
      starts_at: "2025-03-09T05:00:00Z",
      ends_at: "2025-03-10T04:00:00Z",
    });
  });
  it("rejects a nonexistent calendar day instead of silently moving Samoa's skipped date", async () => {
    await expect(
      closureIntent(closureContext("Pacific/Apia"), {
        ...draft,
        from: "2011-12-30",
        to: "2011-12-30",
      }),
    ).rejects.toThrow("CLOSURE_DATE_UNAVAILABLE");
  });
  it("requires an explicit offset for a repeated midnight and honors the chosen occurrence", async () => {
    const context = closureContext("America/Havana");
    const value = { ...draft, from: "2020-11-01", to: "2020-11-01" };
    await expect(closureIntent(context, value)).rejects.toBeInstanceOf(ClosureTimeError);
    const earlier = await closureIntent(context, { ...value, startOffset: "-04:00" });
    const later = await closureIntent(context, { ...value, startOffset: "-05:00" });
    expect(earlier.interval.starts_at).toBe("2020-11-01T04:00:00Z");
    expect(later.interval.starts_at).toBe("2020-11-01T05:00:00Z");
    expect(earlier.interval.ends_at).toBe(later.interval.ends_at);
  });
});
