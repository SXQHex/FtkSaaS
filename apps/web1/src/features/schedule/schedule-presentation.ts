import type { TFunction } from "i18next";
import { getTemporal } from "../../lib/temporal";
import type { SessionView, ResourceRef } from "../../lib/api-contracts/generated";
import type { ScheduleReadItem, readScheduleSources } from "./schedule-read";
import type { ScheduleEvent } from "./schedule-view";
import type { ScheduleSessionDraft, ScheduleSessionPanel } from "./schedule-session-sheet";

type Sources = Awaited<ReturnType<typeof readScheduleSources>>;
export function scheduleEvents(entries: ScheduleReadItem[], sources: Sources): ScheduleEvent[] {
  const rooms = new Map(sources.resources.rooms.map((room) => [room.id, room.name]));
  const instructors = new Map(
    sources.instructors.map((item) => [item.person.id, item.person.display_name]),
  );
  return entries.map((entry) => ({
    id: `${entry.type}:${entry.item.id}`,
    title: entry.item.title,
    start: entry.item.starts_at,
    end: entry.item.ends_at,
    room:
      entry.item.resources
        ?.filter((r) => r.kind === "room")
        .map((r) => rooms.get(r.id))
        .filter(Boolean)
        .join(" · ") || null,
    instructor:
      entry.type === "session"
        ? entry.session.assignments
            .filter((item) => item.duty === "instructor")
            .map((item) => instructors.get(item.person_id))
            .filter(Boolean)
            .join(" · ") || null
        : null,
    state: entry.type === "session" ? entry.session.state : null,
    canChange: entry.type === "session" && entry.session.state === "planned",
    reserved: entry.type === "session" ? entry.session.capacity.held : null,
    capacity: entry.type === "session" ? entry.session.capacity.total : null,
  }));
}
export async function scheduleSessionDraft(
  session: SessionView,
  resources: ResourceRef[] | null,
  timezone: string,
): Promise<ScheduleSessionDraft> {
  const temporal = await getTemporal(),
    start = temporal.Instant.from(session.starts_at).toZonedDateTimeISO(timezone),
    end = temporal.Instant.from(session.ends_at);
  return {
    date: start.toPlainDate().toString(),
    time: start.toPlainTime().toString({ smallestUnit: "second" }),
    duration: String(start.toInstant().until(end).total({ unit: "minute" })),
    capacity: String(session.capacity.total),
    roomId: resources?.find((r) => r.kind === "room")?.id ?? "",
    instructorId: session.assignments.find((item) => item.duty === "instructor")?.person_id ?? "",
    scope: "single",
    reason: "",
    note: "",
    notify: false,
    replacement: false,
    replacementDate: "",
    replacementTime: "",
    replacementRoomId: "",
    offset: start.offset,
    selectedPeople: [],
    addPersonId: "",
  };
}
export function scheduleSessionPanel(
  session: SessionView,
  resources: ResourceRef[] | null,
  sources: Sources,
  t: TFunction,
  title: string,
): ScheduleSessionPanel {
  const format = new Intl.DateTimeFormat("tr-TR", {
    timeZone: sources.center.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  });
  const rooms = resources
    ?.filter((item) => item.kind === "room")
    .map((item) => sources.resources.rooms.find((room) => room.id === item.id)?.name)
    .filter(Boolean)
    .join(" · ");
  const teachers = session.assignments
    .filter((item) => item.duty === "instructor")
    .map(
      (item) =>
        sources.instructors.find((role) => role.person.id === item.person_id)?.person.display_name,
    )
    .filter(Boolean)
    .join(" · ");
  const unknown = t(($) => $.schedule.unknown);
  return {
    title,
    subtitle: `${format.format(new Date(session.starts_at))} – ${format.format(new Date(session.ends_at))} · ${sources.center.timezone}`,
    badges: [
      t(($) => $.schedule.sessionStates[session.state]),
      t(($) => $.schedule.formats[session.format]),
    ],
    facts: [
      { label: t(($) => $.schedule.room), value: rooms || unknown },
      { label: t(($) => $.schedule.instructor), value: teachers || unknown },
      {
        label: t(($) => $.schedule.capacity),
        value: t(($) => $.schedule.occupancy, {
          reserved: session.capacity.held,
          capacity: session.capacity.total,
        }),
      },
    ],
    roster: null,
    effects: [],
  };
}

/** Safe native blocker codes reuse the same translated errors as rejected commands. */
export function scheduleBackendError(code: string, t: TFunction) {
  return code === "POLICY_NOT_CONFIGURED"
    ? t(($) => $.schedule.errors.configuration)
    : code === "CAPACITY_FULL"
      ? t(($) => $.schedule.errors.capacity)
      : code === "RESOURCE_CONFLICT"
        ? t(($) => $.schedule.errors.conflict)
        : code === "RESERVATION_EXISTS"
          ? t(($) => $.schedule.errors.reservation)
          : [
                "PLAN_FEATURE_UNAVAILABLE",
                "PLAN_LIMIT_REACHED",
                "BILLING_OPERATION_RESTRICTED",
              ].includes(code)
            ? t(($) => $.schedule.errors.plan)
            : code === "DOCUMENT_REQUIRED"
              ? t(($) => $.schedule.errors.document)
              : [
                    "ENTITLEMENT_UNAVAILABLE",
                    "INSUFFICIENT_STUDENT_CREDIT",
                    "CREDIT_LIMIT_EXCEEDED",
                    "QUOTA_EXCEEDED",
                  ].includes(code)
                ? t(($) => $.schedule.errors.entitlement)
                : ["VERSION_CONFLICT", "PREVIEW_STALE"].includes(code)
                  ? t(($) => $.schedule.stale)
                  : t(($) => $.schedule.rejected);
}
