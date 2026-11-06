import { expect, test } from "vitest";
import { resourcePatch, seriesOffset } from "../src/lib/session-resources";
import { sampleSession } from "../src/components/admin/session-change-fixtures";
test("untouched resources are omitted and instructor replacement preserves assistant agreements", () => {
  const session = {
    ...sampleSession,
    assignments: [
      { person_id: "assistant", duty: "assistant" as const, agreement_id: "agreement" },
      { person_id: "teacher", duty: "instructor" as const, agreement_id: "old" },
    ],
  };
  expect(resourcePatch(session, {})).toEqual({});
  expect(resourcePatch(session, { roomId: "room" })).toEqual({
    resources: [{ kind: "room", id: "room" }],
  });
  expect(resourcePatch(session, { instructorId: "new" })).toEqual({
    assignments: [session.assignments[0], { person_id: "new", duty: "instructor" }],
  });
  expect(resourcePatch(session, { instructorId: "teacher" }).assignments).toEqual(
    session.assignments,
  );
  expect(() => resourcePatch(session, { roomId: "" })).toThrow("invalidForm");
});
test("series offsets must resolve a real ambiguous local time", () => {
  expect(seriesOffset("2030-10-27", "2030-10-20T02:30:00", "Europe/Berlin", 60)).toEqual({
    date: "2030-10-27",
    offset_minutes: 60,
  });
  expect(() => seriesOffset("2030-10-27", "2030-10-20T02:30:00", "Europe/Berlin", 300)).toThrow(
    "invalidTime",
  );
  expect(() => seriesOffset("2030-03-31", "2030-03-20T02:30:00", "Europe/Berlin", 60)).toThrow(
    "invalidTime",
  );
});

test("explicit duty lists preserve agreement references and never rewrite room/capacity", () => {
  const assignments = [
    { person_id: "one", duty: "instructor" as const, agreement_id: "terms" },
    { person_id: "two", duty: "instructor" as const },
    { person_id: "help", duty: "assistant" as const },
  ];
  expect(resourcePatch(sampleSession, { assignments })).toEqual({ assignments });
  expect(resourcePatch(sampleSession, { assignments: [] })).toEqual({ assignments: [] });
  expect(() => resourcePatch(sampleSession, { assignments, instructorId: "one" })).toThrow(
    "invalidForm",
  );
  expect(() =>
    resourcePatch(sampleSession, { assignments: [...assignments, assignments[0]] }),
  ).toThrow("invalidForm");
});
