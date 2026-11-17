import { readStudioResources, type StudioScope } from "./studio";
import {
  readStudioAgreements,
  readStudioClosures,
  readStudioInstructors,
  readStudioPrograms,
} from "./studio-reads";
import { readStudioSetup } from "./setup";
import type { ResourceRef } from "../../lib/api-contracts/generated";

export async function readStudioSnapshot(scope: StudioScope, canReadPlan = false) {
  const [resources, instructors] = await Promise.all([
    readStudioResources(scope),
    readStudioInstructors(scope),
  ]);
  const personIds = [...new Set(instructors.map((item) => item.person.id))];
  const closureResources: ResourceRef[] = [
    ...resources.rooms.map((item) => ({ kind: "room" as const, id: item.id })),
    ...personIds
      .filter((id) =>
        instructors.some(
          (item) =>
            item.person.id === id &&
            item.person.relationships.some(
              (relationship) =>
                relationship.center_id === scope.centerId && relationship.state === "active",
            ),
        ),
      )
      .map((id) => ({ kind: "person" as const, id })),
  ];
  const [agreements, programs, closures, setup] = await Promise.all([
    Promise.all(personIds.map((id) => readStudioAgreements(scope, id))),
    Promise.all(
      resources.classes.map(async (item) => ({
        classId: item.id,
        items: await readStudioPrograms(scope, item.id),
      })),
    ),
    Promise.all(closureResources.map((resource) => readStudioClosures(scope, resource))),
    readStudioSetup(scope, resources, instructors, canReadPlan),
  ]);
  return {
    resources,
    instructors,
    setup,
    agreements: agreements.flat(),
    programs,
    closures: closures.flat(),
  };
}
export type StudioSnapshot = Awaited<ReturnType<typeof readStudioSnapshot>>;
