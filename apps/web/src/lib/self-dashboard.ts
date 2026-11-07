import { validate } from "uuid";
import type { CenterView, OrganizationView } from "@ftksaas/api-contracts";
import { setupCall, type SetupScope } from "./studio-setup";
export function selfChoices(studios: { organization: OrganizationView; centers: CenterView[] }[]) {
  return studios.flatMap(({ organization: o, centers }) => {
    const self = o.self_context;
    if (!["normal", "grace"].includes(o.access_mode) || !self || !validate(self.person_id))
      return [];
    return self.centers.flatMap((s) => {
      const center = centers.find(
        (c) => c.id === s.center_id && c.accessible && c.state === "active",
      );
      return center && (s.student || s.instructor || s.assistant)
        ? [
            {
              orgId: o.id,
              centerId: center.id,
              timeZone: center.timezone,
              label: `${o.name} · ${center.name}`,
              personId: self.person_id,
              subscriberNumber: self.subscriber_number,
              student: s.student,
              instructor: s.instructor,
              assistant: s.assistant,
            },
          ]
        : [];
    });
  });
}
export async function readSelfReservations(scope: SetupScope, personId: string, cursor?: string) {
  const p = await setupCall("reservation_list_v1", {
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: personId,
    page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  if (p.items.some((r) => r.person_id !== personId) || (cursor && p.next_cursor === cursor))
    throw Error("invalidSelf");
  return p;
}
