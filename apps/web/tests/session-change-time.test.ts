import { expect, test } from "vitest";
import { localDateTime, localTimeChoices } from "../src/lib/session-change";
test("Istanbul local time resolves to its exact UTC instant", () => {
  expect(localTimeChoices("2030-10-29T18:00", "Europe/Istanbul")).toEqual([
    { instant: "2030-10-29T15:00:00.000Z", offsetMinutes: 180 },
  ]);
  expect(localDateTime("2030-10-29T15:00:00Z", "Europe/Istanbul")).toBe("2030-10-29T18:00:00");
});
test("daylight-saving gaps and invalid calendar dates are not normalized", () => {
  expect(localTimeChoices("2027-03-28T02:30", "Europe/Berlin")).toEqual([]);
  expect(localTimeChoices("2027-02-30T14:00", "Europe/Istanbul")).toEqual([]);
});
test("repeated local hours expose both offsets for an explicit user choice", () => {
  expect(localTimeChoices("2027-10-31T02:30", "Europe/Berlin")).toEqual([
    { instant: "2027-10-31T00:30:00.000Z", offsetMinutes: 120 },
    { instant: "2027-10-31T01:30:00.000Z", offsetMinutes: 60 },
  ]);
});

test("short years stay padded in native date inputs", () => {
  expect(localDateTime("0011-11-10T19:00:00Z", "UTC")).toBe("0011-11-10T19:00:00");
});

test("editing a short year does not crash time resolution", () => {
  expect(() => localTimeChoices("0011-11-10T19:00", "Europe/Istanbul")).not.toThrow();
  expect(localTimeChoices("0011-11-10T19:00", "UTC")).toEqual([
    { instant: "0011-11-10T19:00:00.000Z", offsetMinutes: 0 },
  ]);
});
