import { v7 as uuidv7 } from "uuid";
import { studioBackend, type ClassRecord, type StudioScope } from "./studio";
import { readStudioInstructors } from "./studio-reads";

export interface InstructorClassAssignment {
  classId: string;
  personId: string;
  id?: string;
  version?: number;
  active: boolean;
}

export async function readInstructorEditor(
  scope: StudioScope,
  personId: string,
  classes: ClassRecord[],
) {
  const roles = await readStudioInstructors(scope, personId);
  const person = roles[0]?.person;
  if (!person) throw new Error("STUDIO_UNAVAILABLE");
  const accessible = person.relationships.some(
    (item) => item.center_id === scope.centerId && item.state === "active",
  );
  // The exact class-duty reader requires a live center relationship. An inactive
  // membership does not prove an empty set of class assignments.
  if (!accessible) return { person, roles, assignments: null };
  if (
    classes.some(
      (item) =>
        item.scope.accountId !== scope.accountId ||
        item.scope.orgId !== scope.orgId ||
        item.scope.centerId !== scope.centerId,
    )
  )
    throw new Error("STUDIO_UNAVAILABLE");
  const backend = await studioBackend(scope);
  const activeClasses = classes.filter((item) => item.active);
  const assignments: InstructorClassAssignment[] = new Array(activeClasses.length);
  let next = 0;
  // This is an exact-key reader, not an unbounded class × person page load.
  // Limit detail requests to four and read only the explicitly opened person.
  await Promise.all(
    Array.from({ length: Math.min(4, activeClasses.length) }, async () => {
      while (next < activeClasses.length) {
        const index = next++;
        const lesson = activeClasses[index]!;
        const page = await backend.call("management_state_get_v1", {
          client_api_version: 1,
          request_id: uuidv7(),
          org_id: scope.orgId,
          center_id: scope.centerId,
          operation: "class_assignment_set_v1",
          selector: {
            operation: "class_assignment_set_v1",
            key: { class_id: lesson.id, person_id: personId, duty: "instructor" },
          },
        });
        const item = page.items[0];
        if (
          page.items.length !== 1 ||
          page.next_cursor ||
          item?.current?.operation !== "class_assignment_set_v1" ||
          item.current.values.class_id !== lesson.id ||
          item.current.values.person_id !== personId ||
          item.current.values.duty !== "instructor"
        )
          throw new Error("STUDIO_UNAVAILABLE");
        if (!item.exists) {
          if (item.entity !== null || item.state !== null || item.versions.length)
            throw new Error("STUDIO_UNAVAILABLE");
          assignments[index] = { classId: lesson.id, personId, active: false };
          continue;
        }
        if (
          item.entity?.type !== "class_assignments" ||
          (item.state !== "active" && item.state !== "inactive") ||
          item.current.values.state !== item.state
        )
          throw new Error("STUDIO_UNAVAILABLE");
        const versions = item.versions.filter(
          (entry) =>
            entry.entity.type === "class_assignments" && entry.entity.id === item.entity?.id,
        );
        const version = versions[0]?.version;
        if (versions.length !== 1 || !version || !Number.isSafeInteger(version) || version < 1)
          throw new Error("STUDIO_UNAVAILABLE");
        assignments[index] = {
          classId: lesson.id,
          personId,
          id: item.entity.id,
          version,
          active: item.state === "active",
        };
      }
    }),
  );
  return { person, roles, assignments };
}
export type InstructorEditorState = Awaited<ReturnType<typeof readInstructorEditor>>;
