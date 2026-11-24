import { expect, it } from "vitest";
import { calendarSessionReturn } from "./calendar-session-return";

const orgId = "019a7b00-0000-7000-8000-000000000001";
const sessionId = "019a7b00-0000-7000-8000-000000000002";
const path = `/organizasyon/${orgId}/seans/${sessionId}`;

it("accepts only the legacy calendar path with two UUIDs", () => {
  expect(calendarSessionReturn(path)).toBe(path);
  expect(calendarSessionReturn(path.replace(orgId, orgId.toUpperCase()))).toBe(path);
});

it.each([
  `https://example.invalid${path}`,
  `//example.invalid${path}`,
  `${path}?next=//example.invalid`,
  `${path}#fragment`,
  `${path}/extra`,
  `${path}\n`,
  `/organizasyon/invalid/seans/${sessionId}`,
  `/organizasyon/${orgId}/seans/%2e%2e`,
  "/reset-password",
  undefined,
  [path],
])("rejects a return outside the calendar route (%s)", (value) => {
  expect(calendarSessionReturn(value)).toBeUndefined();
});
