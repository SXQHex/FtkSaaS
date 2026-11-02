import { expect, test } from "vitest";
import { buildProgram, programDays } from "../src/lib/program";
const input = {
  starts_on: "2030-03-01",
  ends_on: "2030-04-01",
  weekdays: [7],
  local_start: "02:30",
  duration_minutes: 60,
  room_id: "room",
  person_id: "teacher",
  total: 20,
};
test("program dates are finite and end-exclusive", () => {
  expect(programDays("2030-03-01", "2030-03-04", [7])).toEqual(["2030-03-03"]);
  expect(() => programDays("2030-02-30", "2030-03-04", [7])).toThrow("invalidForm");
  expect(() => programDays("2030-03-04", "2030-03-04", [7])).toThrow("invalidForm");
});
test("DST gaps block the program instead of shifting a session", () => {
  expect(() => buildProgram(input, "Europe/Berlin", {})).toThrow("nonexistentTime");
});
test("every ambiguous occurrence requires an explicit offset", () => {
  const autumn = { ...input, starts_on: "2030-10-01", ends_on: "2030-11-01" };
  expect(() => buildProgram(autumn, "Europe/Berlin", {})).toThrow("chooseOffsets");
  const schedule = buildProgram(autumn, "Europe/Berlin", { "2030-10-27": 60 });
  expect(schedule.offset_choices).toEqual([{ date: "2030-10-27", offset_minutes: 60 }]);
  expect(schedule.assignments).toEqual([{ person_id: "teacher", duty: "instructor" }]);
  expect(() => buildProgram(autumn, "Europe/Berlin", { "2030-10-27": 300 })).toThrow(
    "chooseOffsets",
  );
});
test("zero capacity survives and missing duration is not defaulted", () => {
  expect(
    buildProgram({ ...input, local_start: "12:00", total: 0 }, "Europe/Istanbul", {}).capacity
      .total,
  ).toBe(0);
  expect(() => buildProgram({ ...input, duration_minutes: 0 }, "Europe/Istanbul", {})).toThrow(
    "invalidForm",
  );
});
