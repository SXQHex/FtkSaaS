import { expect, test } from "vitest";
import { operatingPatch, validOperating, operatingSlot } from "../src/lib/operating-settings";
const id = "019a2b3c-4d5e-7000-8000-000000000001";
test("operating settings use exact finite program duration and native TR phone normalization", () => {
  expect(operatingPatch("program_duration_minutes", "75")).toEqual({
    program_duration_minutes: 75,
  });
  expect(operatingPatch("contact_phone", "05321234567")).toEqual({
    contact_phone: "+905321234567",
  });
  expect(operatingPatch("contact_email", "")).toEqual({ contact_email: null });
  for (const value of ["0", "01", "-1", "1.5", "2147483648"])
    expect(() => operatingPatch("program_duration_minutes", value)).toThrow("invalidSettings");
});
test("organization recovery cannot carry a center, wrong slot, another setting or an invented version", () => {
  const input = {
    scope: "organization",
    expected_version: 0,
    reason: "Süre hazırlığı",
    patch: { program_duration_minutes: 75 },
  };
  expect(validOperating(input, undefined, operatingSlot("organization"))).toBe(true);
  for (const changed of [
    { center_id: id },
    { expected_version: -1 },
    { patch: { finance_collect: true } },
    { patch: { program_duration_minutes: 60, address: "" } },
  ])
    expect(validOperating({ ...input, ...changed }, id, operatingSlot("organization"))).toBe(false);
  expect(validOperating(input, id, operatingSlot("center"))).toBe(false);
});

test("reset journals require real token/id/version and cannot carry a center's billing patch", () => {
  const input = {
    scope: "center",
    center_id: id,
    expected_version: 0,
    reason: "Varsayılana dön",
    preview: { id, token: "exact-token" },
  };
  expect(validOperating(input, id, operatingSlot("center"))).toBe(true);
  expect(
    validOperating({ ...input, preview: { id: "bad", token: "" } }, id, operatingSlot("center")),
  ).toBe(false);
  expect(
    validOperating(
      {
        scope: "center",
        center_id: id,
        expected_version: 1,
        reason: "Fatura",
        patch: { billing_name: "X" },
      },
      id,
      operatingSlot("center"),
    ),
  ).toBe(false);
});
