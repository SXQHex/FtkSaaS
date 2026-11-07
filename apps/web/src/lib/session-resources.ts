import type { DutyInput, SessionPatch, SessionView } from "@ftksaas/api-contracts";
import { localTimeChoices } from "./session-change";
export type ResourceDraft = {
  assignments?: DutyInput[];
  assignmentReferences?: DutyInput[];
  dutyNames?: Record<string, string>;
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
  if (draft.assignments !== undefined) {
    if (draft.instructorId !== undefined) throw Error("invalidForm");
    const keys = new Set<string>();
    for (const item of draft.assignments) {
      const key = `${item.person_id}:${item.duty}`;
      if (!item.person_id || !["instructor", "assistant"].includes(item.duty) || keys.has(key))
        throw Error("invalidForm");
      keys.add(key);
    }
    patch.assignments = draft.assignments;
  }
  return patch;
}
export function seriesOffset(date: string, localStart: string, timeZone: string, offset: number) {
  const choices = localTimeChoices(`${date}T${localStart.slice(11)}`, timeZone);
  if (choices.length < 2 || !choices.some((c) => c.offsetMinutes === offset))
    throw Error("invalidTime");
  return { date, offset_minutes: offset };
}
