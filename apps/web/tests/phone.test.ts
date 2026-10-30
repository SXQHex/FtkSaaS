import { expect, test } from "vitest";
import { normalizePhone } from "../src/lib/phone";

test.each(["0555 123 45 67", "5551234567", "+90 (555) 123 45 67"])(
  "defaults %s to Turkey and returns E.164",
  (input) => {
    expect(normalizePhone(input)).toBe("+905551234567");
  },
);
test("an explicit foreign country code overrides the Turkey default", () => {
  expect(normalizePhone("+44 20 7946 0018")).toBe("+442079460018");
});
test.each(["", "555", "+901111111111", "Call +90 555 123 45 67", "+90 555 123 45 67 ext. 12"])(
  "rejects invalid or unsupported input %s",
  (input) => {
    expect(normalizePhone(input)).toBeUndefined();
  },
);
