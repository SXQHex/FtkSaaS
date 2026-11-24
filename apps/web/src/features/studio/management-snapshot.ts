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
  const [agreements, programRows, closures, setup] = await Promise.all([
    readStudioAgreements(scope, personIds, readContext).catch((error: unknown) => {
      if (error instanceof BackendError && error.code === "PLAN_FEATURE_UNAVAILABLE") return null;
      throw error;
    }),
    readStudioPrograms(
      scope,
      resources.classes.map(({ id }) => id),
      readContext,
    ),
    readStudioClosures(scope, closureResources, readContext),
    readStudioSetup(scope, resources, instructors, readPlan, readContext),
  ]);
  const programs = resources.classes.map(({ id: classId }) => ({
    classId,
    items: programRows.filter(
      ({ current }) =>
        current?.operation === "program_preview_v1" && current.values.class_id === classId,
    ),
  }));
  const agreementsPlanBlocked =
    agreements === null || (setup.plan.state === "known" && setup.plan.value?.plan === "starter");
  return {
    resources,
    instructors,
    setup,
    agreementsPlanBlocked,
    agreements: agreementsPlanBlocked ? [] : agreements,
    programs,
    closureResources,
    closures,
  };
}
export type StudioSnapshot = Awaited<ReturnType<typeof readStudioSnapshot>>;
