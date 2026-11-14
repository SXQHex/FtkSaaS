import type { TFunction } from "i18next";
import type { StudioSnapshot } from "./management-snapshot";
import type { StudioViewData } from "./studio-view";

// Display only: money stays an integer string, including above JS safe integer.
function money(minor: string, currency: string) {
  const format = new Intl.NumberFormat("tr-TR", { style: "currency", currency });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 0;
  const amount = BigInt(minor);
  const absolute = amount < 0n ? -amount : amount;
  const divisor = 10n ** BigInt(digits);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(digits, "0");
  const signed = amount < 0n ? (whole === 0n ? -0 : -whole) : whole;
  return format
    .formatToParts(signed)
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("");
}

export function studioViewData(snapshot: StudioSnapshot, t: TFunction): StudioViewData {
  const { resources } = snapshot;
  const people = new Map(snapshot.instructors.map((item) => [item.person.id, item.person]));
  const activePeople = new Set(
    snapshot.instructors.filter((item) => item.active).map((item) => item.person.id),
  );
  const utc = (value: string) =>
    `${new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" }).format(new Date(value))} UTC`;
  const names = new Map([
    ...resources.rooms.map((item) => [item.id, item.name] as const),
    ...[...people.values()].map((item) => [item.id, item.display_name] as const),
  ]);
  return {
    instructors: [...people.values()].map((person) => ({
      id: person.id,
      name: person.display_name,
      email: person.contacts?.find((item) => item.kind === "email")?.value ?? null,
      active: activePeople.has(person.id),
      classes: [],
      classIds: [],
      weeklySessions: null,
    })),
    rooms: resources.rooms.map((item) => ({ ...item, usage: null, classes: [] })),
    roomLimit: null,
    classes: resources.classes.map((item) => {
      const programs = snapshot.programs
        .find((entry) => entry.classId === item.id)
        ?.items.filter((entry) => entry.state === "active");
      const projection = programs?.length === 1 ? programs[0]?.current : undefined;
      const program =
        projection?.operation === "program_preview_v1" ? projection.values.schedule : undefined;
      // Several active program windows do not define a single class default.
      return {
        ...item,
        duration: program?.duration_minutes ?? null,
        capacity: program?.capacity.total ?? null,
        room: program?.room_id
          ? (resources.rooms.find((room) => room.id === program.room_id)?.name ?? null)
          : null,
        instructor: null,
        weeklySessions: program?.weekdays.length ?? null,
      };
    }),
    closures: snapshot.closures.map((item) => ({
      id: item.id,
      period: `${utc(item.interval.starts_at)} – ${utc(item.interval.ends_at)}`,
      scope: names.get(item.resource.id) ?? t(($) => $.studio.unavailableResource),
      reason: t(($) => $.studio.reasonNotShared),
      affectedSessions: null,
      status:
        new Date(item.interval.ends_at).getTime() <= Date.now()
          ? t(($) => $.studio.past)
          : t(($) => $.studio.active),
      past: new Date(item.interval.ends_at).getTime() <= Date.now(),
    })),
    agreements: snapshot.agreements.map((item) => ({
      id: item.id,
      instructorId: item.person_id,
      instructor:
        people.get(item.person_id)?.display_name ?? t(($) => $.studio.unavailableResource),
      model: t(($) => $.studio.payModels[item.terms.model]),
      fee: item.terms.components
        .map((component) =>
          component.kind === "percentage"
            ? component.rate_bps == null
              ? "—"
              : `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(component.rate_bps / 100)}%`
            : component.amount_minor == null
              ? "—"
              : money(component.amount_minor, item.terms.currency),
        )
        .join(" + "),
      effective: `${utc(item.valid.starts_at)} – ${item.valid.ends_at ? utc(item.valid.ends_at) : t(($) => $.studio.openEnded)}`,
      version: String(item.version),
      weeklyEstimate: null,
    })),
    disciplines: resources.disciplines
      .filter((item) => item.state === "active" && item.presentation?.center?.state === "active")
      .map(({ id, name }) => ({ id, name })),
    compatibility: [],
    availability: {},
    setup: [],
  };
}
