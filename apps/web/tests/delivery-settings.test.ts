import { expect, test } from "vitest";
import { v7 } from "uuid";
import { deliveryQuery, validDelivery, deliveryValue } from "../src/lib/delivery-settings";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
const scope = { actorId: v7(), orgId: v7() };
test("quiet hours use the native own-account scope and recover without another actor or org selector", () => {
  const input = {
    ...deliveryQuery(scope, "user"),
    operation_key: v7(),
    expected_version: 0,
    patch: { quiet_hours_start: "23:00" },
  };
  sessionStorage.setItem(
    setupStorageKey(scope, "delivery:user"),
    JSON.stringify({ command: { operation: "settings_update_v1", input } }),
  );
  expect(recoverSetup(scope, "delivery:user")).not.toBe("invalid");
  expect(validDelivery({ ...input, org_id: scope.orgId }, undefined, "delivery:user")).toBe(false);
  expect(validDelivery(input, v7(), "delivery:user")).toBe(false);
});
test("only published reminder choices, valid week days and IANA zones are accepted", () => {
  expect(deliveryValue("lesson_reminder_hours", 24)).toBe(true);
  expect(deliveryValue("lesson_reminder_hours", 12)).toBe(false);
  expect(deliveryValue("quiet_hours_weekdays", [1, 1])).toBe(false);
  expect(deliveryValue("timezone_name", "Europe/Istanbul")).toBe(true);
  expect(deliveryValue("timezone_name", "Mars/Here")).toBe(false);
});
