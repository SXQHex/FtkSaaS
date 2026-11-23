import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import { instructorPeriod } from "../instructor/instructor-read";
import type {
  CalendarItem,
  Interval,
  MemberLessonDiscovery,
  SessionCapacityView,
} from "@ftksaas/api-contracts";
const count = z.number().int().nonnegative().safe(),
  positive = z.number().int().positive().safe(),
  instant = z.iso.datetime({ offset: true });
const cancellation = z.object({
  status: z.enum(["available", "not_configured"]),
  source: z.enum(["current_policy", "reservation_policy"]),
  policy_version_id: z.uuid().nullable(),
  terms: z
    .object({
      cutoff_minutes: count.nullish(),
      before_cutoff: z.enum(["release", "consume"]),
      after_cutoff: z.enum(["release", "consume"]),
      no_show: z.enum(["release", "consume"]),
    })
    .nullable(),
  cutoff_at: instant.nullable(),
});
const lesson = z.object({
  version: positive,
  format: z.enum(["group", "private"]),
  state: z.literal("planned"),
  attendance_state: z.enum(["open", "closed"]),
  instructor_labels: z.array(z.string()),
  room_labels: z.array(z.string()),
  booking_window: z.object({
    state: z.enum(["not_open", "open", "closed", "not_configured"]),
    policy_version_id: z.uuid().nullable(),
    opens_at: instant.nullable(),
    closes_at: instant.nullable(),
  }),
  cancellation,
  own_reservation: z
    .object({
      id: z.uuid(),
      version: positive,
      state: z.enum(["active", "cancelled", "completed"]),
      mode: z.enum(["priority", "flexible"]),
      cancellation,
    })
    .nullable(),
  waitlist_enabled: z.boolean(),
  own_waitlist: z
    .object({
      id: z.uuid(),
      version: positive,
      state: z.enum(["waiting", "offered", "converted", "left", "closed"]),
      offer: z
        .object({
          id: z.uuid(),
          version: positive,
          state: z.enum(["active", "accepted", "rejected", "expired", "withdrawn"]),
          expires_at: instant,
        })
        .nullable(),
    })
    .nullable(),
});
const categories = z.object({ male: count, female: count });
const capacity = z.object({
  total: count,
  held: count,
  remaining: count,
  categories: categories.nullish(),
  category_held: categories.nullable(),
  category_remaining: categories.nullable(),
  room_capacity: count.nullable(),
});
export type MemberClass = CalendarItem & {
  member_lesson: MemberLessonDiscovery;
  capacity: SessionCapacityView;
};
export async function memberClassWeek(
  timezone: string,
  now: string,
  offset = 0,
  weekStart: "monday" | "sunday" = "monday",
) {
  const base = await instructorPeriod(timezone, weekStart, now, offset),
    T = await getTemporal();
  const start = T.PlainDate.from(base.start);
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = start.add({ days: i });
    const date = new Date(day.toZonedDateTime(timezone).epochMilliseconds);
    return {
      id: day.toString(),
      weekday: new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: timezone }).format(
        date,
      ),
      day: String(day.day),
      label: new Intl.DateTimeFormat("tr-TR", { dateStyle: "full", timeZone: timezone }).format(
        date,
      ),
      today: day.toString() === base.today,
    };
  });
  return { ...base, days, range: `${days[0]!.label} – ${days[6]!.label}` };
}
export async function readMemberClasses(
  scope: ClientScope,
  interval: Interval,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, readContext),
    items: MemberClass[] = [],
    ids = new Set<string>(),
    cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await backend.call("calendar_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      interval: { ...interval },
      member_discovery: true,
      page: { limit: 50, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
    });
    if (page.items.length > 50) throw Error("MEMBER_CLASSES_UNAVAILABLE");
    for (const row of page.items) {
      z.uuid().parse(row.id);
      instant.parse(row.starts_at);
      instant.parse(row.ends_at);
      if (
        row.type !== "session" ||
        row.center_id !== scope.centerId ||
        ids.has(row.id) ||
        Date.parse(row.starts_at) >= Date.parse(interval.ends_at) ||
        Date.parse(row.ends_at) <= Date.parse(interval.starts_at) ||
        Date.parse(row.ends_at) <= Date.parse(row.starts_at)
      )
        throw Error("MEMBER_CLASSES_UNAVAILABLE");
      lesson.parse(row.member_lesson);
      capacity.parse(row.capacity);
      ids.add(row.id);
      items.push(row as MemberClass);
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw Error("MEMBER_CLASSES_UNAVAILABLE");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return items;
}
