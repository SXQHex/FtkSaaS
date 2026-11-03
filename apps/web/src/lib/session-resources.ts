import type { SessionPatch, SessionView } from "@ftksaas/api-contracts";
import { localTimeChoices } from "./session-change";
export type ResourceDraft = {
  roomId?: string;
  instructorId?: string;
  roomName?: string;
  instructorName?: string;
};
export function resourcePatch(session: SessionView, draft: ResourceDraft): SessionPatch {
  const patch: SessionPatch = {};
  if (draft.roomId !== undefined) {
    if (!draft.roomId) throw Error("invalidForm");
    patch.resources = [{ kind: "room", id: draft.roomId }];
  }
  if (draft.instructorId !== undefined) {
    if (!draft.instructorId) throw Error("invalidForm");
    const previous = session.assignments.find(
      (a) => a.duty === "instructor" && a.person_id === draft.instructorId,
    );
    patch.assignments = [
      ...session.assignments.filter((a) => a.duty !== "instructor"),
      previous ?? { person_id: draft.instructorId, duty: "instructor" },
    ];
  }
  return patch;
}
export function seriesOffset(date: string, localStart: string, timeZone: string, offset: number) {
  const choices = localTimeChoices(`${date}T${localStart.slice(11)}`, timeZone);
  if (choices.length < 2 || !choices.some((c) => c.offsetMinutes === offset))
    throw Error("invalidTime");
  return { date, offset_minutes: offset };
}
