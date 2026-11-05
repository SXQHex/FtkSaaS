import { expect, test } from "vitest";
import { priceToMinor, productTerms, validPublishedTerms } from "../src/lib/product-terms";
const id = "019a2b3c-4d5e-7000-8000-000000000080";
const draft = {
  name: "Başlangıç",
  disciplineId: id,
  kind: "credits" as const,
  bookingMode: "flexible" as const,
  credits: "8",
  price: "90071992547409,91",
  currency: "TRY",
  quotaPeriod: "month" as const,
  quotaLimit: "4",
  refund: "credit_ratio" as const,
  usedUnitPrice: "",
};
test("currency precision is preserved without Number rounding", () => {
  expect(priceToMinor(draft.price, "TRY")).toBe("9007199254740991");
  expect(priceToMinor("123.456", "KWD")).toBe("123456");
  expect(priceToMinor("12", "JPY")).toBe("12");
  for (const price of ["1.234", "1e3", "-1", "1,000.12", "92233720368547758.08"])
    expect(() => priceToMinor(price, "TRY")).toThrow("invalidProduct");
});
test("explicit draft produces the chosen discipline, center and immutable terms", () => {
  const terms = productTerms(draft, { id, name: "Salsa", state: "active", version: 1 }, id);
  expect(terms).toMatchObject({
    name: "Salsa Başlangıç",
    kind: "credits",
    credits: 8,
    price_minor: "9007199254740991",
    freeze: { enabled: false, extends_validity: false },
    refund: { method: "credit_ratio" },
    scopes: [
      {
        scope_kind: "center_discipline",
        center_id: id,
        discipline_id: id,
        usage_targets: ["lesson"],
      },
    ],
  });
  expect(validPublishedTerms(terms, id)).toBe(true);
});
test("timed quota and unlimited are not fake credits", () => {
  for (const kind of ["quota", "unlimited"] as const) {
    const terms = productTerms(
      { ...draft, kind, refund: "time_ratio" },
      { id, name: "Salsa", state: "active", version: 1 },
      id,
    );
    expect(terms.kind).toBe("timed");
    expect(terms.credits).toBeNull();
    expect(terms.quota).toEqual(kind === "quota" ? { period: "month", limit: 4 } : null);
  }
});
test("recovery refuses cross-center, extra or Starter-incompatible terms", () => {
  const terms = productTerms(draft, { id, name: "Salsa", state: "active", version: 1 }, id);
  for (const item of [
    { ...terms, extra: true },
    { ...terms, freeze: { enabled: true, extends_validity: true } },
    { ...terms, price_minor: "01" },
    { ...terms, scopes: [{ ...terms.scopes[0], center_id: "other" }] },
    { ...terms, credits: 0 },
  ])
    expect(validPublishedTerms(item, id)).toBe(false);
  expect(() =>
    productTerms(
      { ...draft, disciplineId: "other" },
      { id, name: "Salsa", state: "active", version: 1 },
      id,
    ),
  ).toThrow("invalidProduct");
});

test("timed products cannot publish credit-ratio refunds that the native quote cannot calculate", () => {
  expect(() =>
    productTerms(
      { ...draft, kind: "quota", refund: "credit_ratio" },
      { id, name: "Salsa", state: "active", version: 1 },
      id,
    ),
  ).toThrow("invalidProduct");
});
