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

test("inherited duties send no explicit instructor and preserve category limits", () => {
  const schedule = buildProgram(
    {
      ...input,
      local_start: "12:00",
      person_id: "",
      inherit_class_assignments: true,
      categories: { male: 0, female: 20 },
    },
    "Europe/Istanbul",
    {},
  );
  expect(schedule.assignments).toEqual([]);
  expect(schedule.inherit_class_assignments).toBe(true);
  expect(schedule.capacity).toEqual({ total: 20, categories: { male: 0, female: 20 } });
  expect(() =>
    buildProgram({ ...input, local_start: "12:00", person_id: "" }, "Europe/Istanbul", {}),
  ).toThrow("invalidForm");
});
test("explicit programs retain every chosen instructor/assistant while inherited duties stay separate", () => {
  const extras = [
    { person_id: "assistant", duty: "assistant" as const },
    { person_id: "second", duty: "instructor" as const },
  ];
  const result = buildProgram(
    { ...input, local_start: "12:00", extra_assignments: extras },
    "Europe/Istanbul",
    {},
  );
  expect(result.assignments).toEqual([
    { person_id: input.person_id, duty: "instructor" },
    ...extras,
  ]);
  expect(
    buildProgram(
      {
        ...input,
        local_start: "12:00",
        inherit_class_assignments: true,
        extra_assignments: extras,
      },
      "Europe/Istanbul",
      {},
    ).assignments,
  ).toEqual([]);
  expect(() =>
    buildProgram(
      {
        ...input,
        local_start: "12:00",
        extra_assignments: [{ person_id: input.person_id, duty: "instructor" }],
      },
      "Europe/Istanbul",
      {},
    ),
  ).toThrow("invalidForm");
});
