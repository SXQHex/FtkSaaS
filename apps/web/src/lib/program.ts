import type { ManagementStateView, ProgramSpec } from "@ftksaas/api-contracts";
import { localTimeChoices } from "./session-change";
import { setupCall, type SetupScope } from "./studio-setup";

export function programDays(from: string, until: string, weekdays: number[]) {
  function day(value: string) {
    const date = new Date(`${value}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw Error("invalidForm");
    return date;
  }
  const start = day(from),
    end = day(until);
  if (
    start >= end ||
    !weekdays.length ||
    weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)
  )
    throw Error("invalidForm");
  const days: string[] = [];
  for (const date = start; date < end; date.setUTCDate(date.getUTCDate() + 1)) {
    if (weekdays.includes(date.getUTCDay() || 7)) days.push(date.toISOString().slice(0, 10));
  }
  if (!days.length) throw Error("invalidForm");
  return days;
}
export type ProgramInput = {
  starts_on: string;
  ends_on: string;
  weekdays: number[];
  local_start: string;
  duration_minutes: number;
  room_id: string;
  person_id: string;
  total: number;
};
export function buildProgram(
  input: ProgramInput,
  timeZone: string,
  offsets: Record<string, number>,
): ProgramSpec {
  if (
    !input.room_id ||
    !input.person_id ||
    !Number.isSafeInteger(input.total) ||
    input.total < 0 ||
    !Number.isSafeInteger(input.duration_minutes) ||
    input.duration_minutes <= 0
  )
    throw Error("invalidForm");
  const localStart = input.local_start.length === 5 ? `${input.local_start}:00` : input.local_start;
  const choices: NonNullable<ProgramSpec["offset_choices"]> = [];
  for (const date of programDays(input.starts_on, input.ends_on, input.weekdays)) {
    const times = localTimeChoices(`${date}T${localStart}`, timeZone);
    if (!times.length) throw Error("nonexistentTime");
    if (times.length > 1) {
      if (!times.some((item) => item.offsetMinutes === offsets[date])) throw Error("chooseOffsets");
      choices.push({ date, offset_minutes: offsets[date] });
    }
  }
  return {
    weekdays: [input.weekdays[0], ...input.weekdays.slice(1)],
    local_start: localStart,
    starts_on: input.starts_on,
    ends_on: input.ends_on,
    duration_minutes: input.duration_minutes,
    room_id: input.room_id,
    assignments: [{ person_id: input.person_id, duty: "instructor" }],
    capacity: { total: input.total },
    offset_choices: choices,
    inherit_class_assignments: false,
  };
}
export async function getClasses(scope: SetupScope) {
  const items: ManagementStateView[] = [];
  let cursor: string | null | undefined;
  do {
    const data = await setupCall("management_state_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: "class_save_v1",
      selector: { operation: "class_save_v1", key: {} },
      page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    for (const item of data.items) {
      if (!classValues(item)) throw Error("unreadableClass");
      items.push(item);
    }
    cursor = data.next_cursor;
  } while (cursor);
  return items;
}
export function classValues(item: ManagementStateView) {
  const value = item.current?.operation === "class_save_v1" ? item.current.values : null;
  const version = item.versions.find(
    (v) => v.entity.type === "classes" && v.entity.id === item.entity?.id,
  )?.version;
  if (
    item.operation !== "class_save_v1" ||
    !item.exists ||
    item.entity?.type !== "classes" ||
    !version ||
    !value?.name ||
    !value.discipline_id ||
    typeof value.external_open !== "boolean"
  )
    return null;
  return {
    id: item.entity.id,
    version,
    name: value.name,
    discipline_id: value.discipline_id,
    external_open: value.external_open,
  };
}

export async function getProgramCatalog(scope: SetupScope) {
  const { getRooms, getSetupDisciplines, getCenterDiscipline } = await import("./studio-setup");
  const { getSetupRoles } = await import("./instructor-setup");
  const [rooms, disciplines, roles] = await Promise.all([
    getRooms(scope.orgId, scope.centerId!),
    getSetupDisciplines(scope.orgId),
    getSetupRoles(scope),
  ]);
  const candidates = disciplines.filter((d) => d.state === "active");
  const relations = await Promise.all(
    candidates.map((d) => getCenterDiscipline(scope.orgId, scope.centerId!, d.id)),
  );
  const instructors = roles.filter(
    (r) => r.role === "instructor" && r.state === "active" && r.scope_center_id === scope.centerId,
  );
  const people = await Promise.all(
    instructors.map((r) =>
      setupCall("person_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        person_id: r.person_id,
      }),
    ),
  );
  return {
    disciplines: candidates
      .filter((_, i) => relations[i].exists && relations[i].state === "active")
      .map((d) => ({ id: d.id, name: d.name })),
    rooms: rooms
      .filter((r) => r.state === "active")
      .map((r) => {
        if (r.current?.operation !== "room_save_v1" || !r.entity?.id || !r.current.values.name)
          throw Error("unreadableRoom");
        return { id: r.entity.id, name: r.current.values.name };
      }),
    instructors: people.map((p) => ({ id: p.id, name: p.display_name })),
  };
}
