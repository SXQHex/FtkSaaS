import { describe, expect, it } from "vitest";
import { i18n } from "../../i18n";
import type { MemberPageSummary, PersonSummary } from "@ftksaas/api-contracts";
import { peopleRow } from "./people-summary";

const centerId = "019a7b00-0000-7000-8000-000000000004";
const person: PersonSummary = {
  id: "019a7b00-0000-7000-8000-000000000006",
  display_name: "Fixture",
  relationships: [],
};
const summary: MemberPageSummary = {
  as_of: "2026-11-15T00:00:00Z",
  rights: {
    status: "available",
    available_credits: "9007199254740993",
    available_timed_packages: 2,
  },
  debt: {
    status: "available",
    by_currency: [
      { currency: "TRY", remaining_minor: "9007199254740993" },
      { currency: "USD", remaining_minor: "100" },
    ],
  },
  next_lesson: {
    status: "available",
    lesson: {
      session_id: "019a7b00-0000-7000-8000-000000000007",
      starts_at: "2026-12-01T22:30:00Z",
      ends_at: "2026-12-01T23:30:00Z",
    },
  },
};
function row(value: MemberPageSummary | undefined, timezone?: string) {
  return peopleRow({ ...person, member_summary: value }, centerId, i18n.t, timezone);
}
describe("member page summary presentation", () => {
  it("preserves integer precision, separate timed rights and separate currencies", () => {
    const result = row(summary);
    expect(result.entitlement?.label).toBe("9.007.199.254.740.993 kredi · 2 süreli paket");
    expect(result.entitlement?.available).toBeUndefined();
    expect(result.debt).toContain("90.071.992.547.409,93");
    expect(result.debt).toContain("1,00");
    expect(result.debt?.split(" · ")).toHaveLength(2);
    expect(result.debtOutstanding).toBe(true);
  });
  it.each(["restricted", "not_enabled"] as const)(
    "keeps %s distinct from zero and empty results",
    (status) => {
      const result = row({
        ...summary,
        rights: { status },
        debt: { status },
        next_lesson: { status },
      });
      const expected =
        status === "restricted" ? "Bu bilgiyi görme yetkin yok" : "Bu özellik planda açık değil";
      expect(result.entitlement?.label).toBe(expected);
      expect(result.debt).toBe(expected);
      expect(result.nextSession).toBe(expected);
      expect(result.debtOutstanding).toBe(false);
    },
  );
  it("distinguishes an absent projection from known zero and no upcoming lesson", () => {
    expect(row(undefined)).toMatchObject({ entitlement: null, debt: null, nextSession: null });
    expect(
      row({
        ...summary,
        rights: { status: "available", available_credits: "0" },
        debt: { status: "available", by_currency: [] },
        next_lesson: { status: "available", lesson: null },
      }),
    ).toMatchObject({
      entitlement: { label: "0 kredi" },
      debt: "Borç yok",
      nextSession: "Yaklaşan ders yok",
      debtOutstanding: false,
    });
  });
  it("uses the actual center zone across midnight and does not guess an unread zone", () => {
    expect(row(summary).nextSession).toBeNull();
    expect(row(summary, "Europe/Istanbul").nextSession).toContain("2 Ara 2026");
    expect(row(summary, "Europe/Istanbul").nextSession).toContain("01:30");
    expect(row(summary, "UTC").nextSession).toContain("22:30");
  });
});
