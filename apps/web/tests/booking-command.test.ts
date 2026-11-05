import { expect, test } from "vitest";
import { validBookingCommand, bookingFields } from "../src/lib/booking-command";
const id = "019a2b3c-4d5e-7000-8000-000000000080";
const base = { org_id: id, center_id: id, operation_key: id };
test("booking recovery requires exact scope, explicit mode and real target ids", () => {
  const input = { ...base, person_id: id, session_id: id, mode: "flexible", source_sale_id: id };
  expect(validBookingCommand("reservation_create_v1", input, id)).toBe(true);
  for (const bad of [
    { ...input, center_id: undefined },
    { ...input, mode: "guess" },
    { ...input, person_id: "invalid" },
    { ...input, booking_category: "all" },
    { ...input, override: true },
  ])
    expect(validBookingCommand("reservation_create_v1", bad, id)).toBe(false);
  expect(bookingFields.reservation_create_v1).toContain("source_sale_id");
});
test("lesson alternatives require real increasing instants and never replay an implicit exception", () => {
  const input = {
    ...base,
    lesson_request_id: id,
    expected_version: 3,
    alternatives: [
      { interval: { starts_at: "2027-01-01T10:00:00Z", ends_at: "2027-01-01T11:00:00Z" } },
    ],
  };
  expect(validBookingCommand("lesson_request_offer_alternative_v1", input, id)).toBe(true);
  expect(
    validBookingCommand(
      "lesson_request_offer_alternative_v1",
      { ...input, window_exception: true },
      id,
    ),
  ).toBe(false);
  expect(
    validBookingCommand(
      "lesson_request_offer_alternative_v1",
      {
        ...input,
        alternatives: [
          { interval: { starts_at: "2027-01-01T11:00:00Z", ends_at: "2027-01-01T10:00:00Z" } },
        ],
      },
      id,
    ),
  ).toBe(false);
});
test("renewal recovery preserves only an exact preview token", () => {
  expect(
    validBookingCommand(
      "sale_renew_apply_v1",
      { ...base, preview: { id, token: "synthetic" } },
      id,
    ),
  ).toBe(true);
  expect(
    validBookingCommand(
      "sale_renew_apply_v1",
      { ...base, preview: { id, token: "synthetic", override: true } },
      id,
    ),
  ).toBe(false);
});
