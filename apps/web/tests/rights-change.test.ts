import { expect, test } from "vitest";
import { rightsChange, validRightsCommand, matchesRightsPreview } from "../src/lib/rights-change";
const id = "019a2b3c-4d5e-7000-8000-000000000080";
test("rights input accepts exact integers and valid calendar dates only", () => {
  expect(rightsChange("credit_adjust", id, "3", "decrease")).toEqual({
    kind: "credit_adjust",
    sale_id: id,
    quantity: 3,
    direction: "decrease",
  });
  for (const value of ["0", "-1", "1.2", "1e2", "9007199254740993"])
    expect(() => rightsChange("credit_adjust", id, value, "increase")).toThrow("invalidRights");
  expect(() => rightsChange("entitlement_extend", id, "2027-02-30")).toThrow("invalidRights");
  expect(rightsChange("entitlement_extend", id, "2028-02-29")).toEqual({
    kind: "entitlement_extend",
    sale_id: id,
    end_date: "2028-02-29",
  });
  expect(rightsChange("negative_limit", id, "0", undefined, id)).toEqual({
    kind: "negative_limit",
    person_id: id,
    discipline_id: id,
    allowed_negative_credits: 0,
  });
});
test("recovered rights command rejects missing proof, duplicate acknowledgements and hidden fields", () => {
  const input = {
    org_id: id,
    center_id: id,
    operation_key: id,
    sale_id: id,
    quantity: 2,
    direction: "decrease",
    reason: "Düzeltme",
    impact_approval: { id, token: "synthetic" },
    accepted_reservation_ids: [id],
  };
  expect(validRightsCommand("credit_adjust_v1", input, id)).toBe(true);
  for (const bad of [
    { ...input, impact_approval: { id } },
    { ...input, accepted_reservation_ids: [id, id] },
    { ...input, quantity: 0 },
    { ...input, center_id: undefined },
    { ...input, impact_approval: { id, token: "synthetic", extra: true } },
  ])
    expect(validRightsCommand("credit_adjust_v1", bad, id)).toBe(false);
  expect(
    validRightsCommand("entitlement_extend_v1", { ...input, end_date: "2027-01-01" }, id),
  ).toBe(false);
});
test("preview matching compares semantic fields without depending on object order", () => {
  const change = rightsChange("credit_adjust", id, "2", "increase");
  expect(
    matchesRightsPreview(change, {
      sale_id: id,
      direction: "increase",
      quantity: 2,
      kind: "credit_adjust",
    }),
  ).toBe(true);
  expect(matchesRightsPreview(change, { ...change, quantity: 3 })).toBe(false);
  expect(matchesRightsPreview(change, { ...change, extra: true })).toBe(false);
});
