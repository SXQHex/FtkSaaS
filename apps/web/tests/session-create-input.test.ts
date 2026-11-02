import { expect, test } from "vitest";
import { sessionCapacity, sessionInterval, assignmentVersion } from "../src/lib/session-create";
test("category capacities preserve explicit zeros and reject invalid counts", () => {
  expect(sessionCapacity(0, { male: 0, female: 0 })).toEqual({
    total: 0,
    categories: { male: 0, female: 0 },
  });
  expect(() => sessionCapacity(20, { male: NaN, female: 10 })).toThrow("invalidForm");
});
test("single session needs explicit choices at ambiguous local times", () => {
  expect(() =>
    sessionInterval("2030-10-27T02:15", "2030-10-27T03:15", "Europe/Berlin", "", ""),
  ).toThrow("chooseOffsets");
  expect(
    sessionInterval(
      "2030-10-27T02:15",
      "2030-10-27T03:15",
      "Europe/Berlin",
      "2030-10-27T01:15:00.000Z",
      "",
    ),
  ).toEqual({ starts_at: "2030-10-27T01:15:00.000Z", ends_at: "2030-10-27T02:15:00.000Z" });
  expect(() =>
    sessionInterval("2030-03-31T02:15", "2030-03-31T03:15", "Europe/Berlin", "", ""),
  ).toThrow("nonexistentTime");
});
test("class duty uses only its own assignment version", () => {
  const item = {
    operation: "class_assignment_set_v1" as const,
    entity: { type: "class_assignments" as const, id: "assignment" },
    exists: true,
    state: "active" as const,
    as_of: "2030-01-01T00:00:00Z",
    versions: [
      { entity: { type: "classes" as const, id: "class" }, version: 55 },
      { entity: { type: "class_assignments" as const, id: "assignment" }, version: 8 },
    ],
    current: {
      operation: "class_assignment_set_v1" as const,
      values: {
        class_id: "class",
        person_id: "person",
        duty: "instructor" as const,
        state: "active" as const,
      },
    },
  };
  expect(assignmentVersion(item, "class", "person", "instructor")).toEqual({
    state: "active" as const,
    version: 8,
  });
  expect(() =>
    assignmentVersion(
      { ...item, versions: item.versions.slice(0, 1) },
      "class",
      "person",
      "instructor",
    ),
  ).toThrow("unreadableAssignment");
  expect(() => assignmentVersion(item, "other", "person", "instructor")).toThrow(
    "unreadableAssignment",
  );
});
