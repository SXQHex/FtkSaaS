import { z } from "zod";
import { readStudioInstructorClasses, type ClassRecord, type StudioScope } from "./studio";
import { readStudioInstructors } from "./studio-reads";

interface InstructorClassAssignment {
  classId: string;
  personId: string;
  id?: string;
  version?: number;
  active: boolean;
}

const assignmentProjection = z.object({
  person_id: z.uuid(),
  id: z.uuid().nullable(),
  state: z.enum(["active", "inactive"]).nullable(),
  version: z.number().int().positive().safe().nullable(),
});

export async function readInstructorEditor(
  scope: StudioScope,
  personId: string,
  signal?: AbortSignal,
) {
  z.uuid().parse(personId);
  const roles = await readStudioInstructors(scope, personId, undefined, signal);
  const person = roles[0]?.person;
  if (person?.id !== personId) throw new Error("STUDIO_UNAVAILABLE");
  const accessible = person.relationships.some(
    (item) => item.center_id === scope.centerId && item.state === "active",
  );
  const classes: ClassRecord[] = [];
  // Profile editing remains available when class assignments are unreadable.
  if (!accessible || !roles.some((role) => role.active))
    return { person, roles, classes, assignments: null };

  const rows = await readStudioInstructorClasses(scope, personId, signal);
  const assignments: InstructorClassAssignment[] = [];
  const seenClasses = new Set<string>();
  const seenAssignments = new Set<string>();
  for (const { lesson, assignment } of rows) {
    if (!lesson.active || seenClasses.has(lesson.id)) throw new Error("STUDIO_UNAVAILABLE");
    seenClasses.add(lesson.id);
    const entry = assignmentProjection.parse(assignment);
    if (entry.person_id !== personId) throw new Error("STUDIO_UNAVAILABLE");
    if (entry.id === null) {
      if (entry.state !== null || entry.version !== null) throw new Error("STUDIO_UNAVAILABLE");
      assignments.push({ classId: lesson.id, personId, active: false });
    } else {
      if (entry.state === null || entry.version === null || seenAssignments.has(entry.id))
        throw new Error("STUDIO_UNAVAILABLE");
      seenAssignments.add(entry.id);
      assignments.push({
        classId: lesson.id,
        personId,
        id: entry.id,
        version: entry.version,
        active: entry.state === "active",
      });
    }
    classes.push(lesson);
  }
  return { person, roles, classes, assignments };
}
export type InstructorEditorState = Awaited<ReturnType<typeof readInstructorEditor>>;
