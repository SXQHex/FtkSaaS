import type { Duty, DutyInput, ManagementStateView, SessionCapacity } from "@ftksaas/api-contracts";
import { localTimeChoices } from "./session-change";
export function sessionCapacity(
  total: number,
  categories?: SessionCapacity["categories"],
): SessionCapacity {
  const count = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (!count(total) || (categories && (!count(categories.male) || !count(categories.female))))
    throw Error("invalidForm");
  return { total, categories: categories ?? null };
}
export function sessionInterval(
  start: string,
  end: string,
  timeZone: string,
  fromChoice: string,
  toChoice: string,
) {
  function choose(value: string, choice: string) {
    const options = localTimeChoices(value, timeZone);
    if (!options.length) throw Error("nonexistentTime");
    const selected = options.length === 1 ? options[0] : options.find((o) => o.instant === choice);
    if (!selected) throw Error("chooseOffsets");
    return selected.instant;
  }
  const starts_at = choose(start, fromChoice),
    ends_at = choose(end, toChoice);
  if (Date.parse(starts_at) >= Date.parse(ends_at)) throw Error("invalidForm");
  return { starts_at, ends_at };
}
export function assignmentVersion(
  item: ManagementStateView,
  classId: string,
  personId: string,
  duty: Duty,
) {
  const values = item.current?.operation === "class_assignment_set_v1" ? item.current.values : null;
  if (
    item.operation !== "class_assignment_set_v1" ||
    values?.class_id !== classId ||
    values.person_id !== personId ||
    values.duty !== duty
  )
    throw Error("unreadableAssignment");
  if (!item.exists) {
    if (item.entity !== null || item.versions.length || item.state !== null)
      throw Error("unreadableAssignment");
    return { state: "inactive" as const };
  }
  const version = item.versions.find(
    (v) => v.entity.type === "class_assignments" && v.entity.id === item.entity?.id,
  )?.version;
  if (
    item.entity?.type !== "class_assignments" ||
    !Number.isSafeInteger(version) ||
    !version ||
    version < 1 ||
    !["active", "inactive"].includes(item.state ?? "") ||
    values.state !== item.state
  )
    throw Error("unreadableAssignment");
  return { state: item.state as "active" | "inactive", version };
}

export function sessionAssignments(personId: string, extra: DutyInput[] = []): DutyInput[] {
  const assignments: DutyInput[] = [{ person_id: personId, duty: "instructor" }, ...extra];
  const keys = new Set<string>();
  for (const item of assignments) {
    const key = `${item.person_id}:${item.duty}`;
    if (!item.person_id || !["instructor", "assistant"].includes(item.duty) || keys.has(key))
      throw Error("invalidForm");
    keys.add(key);
  }
  return assignments;
}
