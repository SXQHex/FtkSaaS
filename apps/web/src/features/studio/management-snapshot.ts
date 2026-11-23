import type { AccountReadContext } from "../../lib/scoped-backend";
import { readStudioResources, type readStudioRooms, type StudioScope } from "./studio";
import {
  readStudioAgreements,
  readStudioClosures,
  readStudioInstructors,
  readStudioPrograms,
} from "./studio-reads";
import { readStudioSetup } from "./setup";
import { BackendError } from "../../lib/backend";
import type { ResourceRef, SubscriptionView } from "@ftksaas/api-contracts";

export async function readStudioSnapshot(
  scope: StudioScope,
  readPlan?: () => Promise<SubscriptionView>,
  readContext?: AccountReadContext,
  readRooms?: () => ReturnType<typeof readStudioRooms>,
) {
  const [resources, instructors] = await Promise.all([
    readStudioResources(scope, readContext, readRooms),
    readStudioInstructors(scope, undefined, readContext),
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
    Promise.all(personIds.map((id) => readStudioAgreements(scope, id, readContext))).catch(
      (error: unknown) => {
        if (error instanceof BackendError && error.code === "PLAN_FEATURE_UNAVAILABLE") return null;
        throw error;
      },
    ),
    Promise.all(
      resources.classes.map(async (item) => ({
        classId: item.id,
        items: await readStudioPrograms(scope, item.id, readContext),
      })),
    ),
    Promise.all(
      closureResources.map((resource) => readStudioClosures(scope, resource, readContext)),
    ),
    readStudioSetup(scope, resources, instructors, readPlan, readContext),
  ]);
  const agreementsPlanBlocked =
    agreements === null || (setup.plan.state === "known" && setup.plan.value?.plan === "starter");
  return {
    resources,
    instructors,
    setup,
    agreementsPlanBlocked,
    agreements: agreementsPlanBlocked ? [] : agreements.flat(),
    programs,
    closures: closures.flat(),
  };
}
export type StudioSnapshot = Awaited<ReturnType<typeof readStudioSnapshot>>;
