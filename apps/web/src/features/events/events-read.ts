import { queryBackendRead } from "../../lib/backend";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { EventView, EventState, Interval } from "@ftksaas/api-contracts";
import { getTemporal } from "../../lib/temporal";
import { studioPages } from "../studio/studio";
import { readStudioInstructors } from "../studio/studio-reads";
import { readProductsPage } from "../products/products";
const count = z.number().int().nonnegative().safe(),
  money = z.string().regex(/^\d+$/),
  currency = z.string().regex(/^[A-Z]{3}$/);
const assignment = z.object({ person_id: z.uuid(), duty: z.enum(["instructor", "assistant"]) });
const core = z.object({
  id: z.uuid(),
  center_id: z.uuid(),
  name: z.string().min(1),
  timezone: z.string().min(1),
  version: z.number().int().positive().safe(),
  state: z.enum(["draft", "published", "occurred", "cancelled"]),
  attendance_state: z.enum(["open", "closed"]),
  interval: z.object({
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
  }),
  venue: z.object({
    kind: z.enum(["internal", "external"]),
    room_id: z.uuid().nullish(),
    name: z.string().nullish(),
    address: z.string().nullish(),
    timezone: z.string().min(1),
  }),
  capacity: z.union([
    z.object({ nominal: count, maximum: count }),
    z.object({ kind: z.literal("unlimited") }),
  ]),
  terms: z.object({
    fee_minor: money,
    currency,
    full_payment_required: z.boolean(),
    allowed_product_version_ids: z.array(z.uuid()),
    cancellation: z.object({
      cutoff_minutes: count.nullish(),
      before_cutoff: z.enum(["release", "consume"]),
      after_cutoff: z.enum(["release", "consume"]),
      no_show: z.enum(["release", "consume"]),
    }),
    refund: z.object({
      method: z.enum(["none", "credit_ratio", "used_at_unit_price", "time_ratio"]),
      used_unit_minor: money.nullish(),
    }),
    package_usage: z.enum(["consume", "eligibility_only"]).optional(),
  }),
  discipline_ids: z.array(z.uuid()),
  assignments: z.array(assignment),
  assignment_terms: z.array(assignment.extend({ fee_minor: money, currency })).optional(),
});
export async function validateEvent(value: EventView, scope: ClientScope, id?: string) {
  core.parse(value);
  const T = await getTemporal();
  if (
    value.center_id !== scope.centerId ||
    (id && value.id !== id) ||
    T.Instant.compare(value.interval.starts_at, value.interval.ends_at) >= 0 ||
    (!("kind" in value.capacity) && value.capacity.maximum < value.capacity.nominal) ||
    ("kind" in value.capacity && value.venue.kind !== "external")
  )
    throw new Error("EVENT_SOURCE_UNAVAILABLE");
  T.Instant.from(value.interval.starts_at).toZonedDateTimeISO(value.timezone);
  T.Instant.from(value.interval.starts_at).toZonedDateTimeISO(value.venue.timezone);
  return value;
}
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export async function eventMonth(
  timezone: string,
  month?: string,
  now = Date.now(),
): Promise<{ month: string; interval: Interval }> {
  const T = await getTemporal();
  const value = month
    ? T.PlainYearMonth.from(month)
    : T.Instant.fromEpochMilliseconds(now)
        .toZonedDateTimeISO(timezone)
        .toPlainDate()
        .toPlainYearMonth();
  const start = value.toPlainDate({ day: 1 }).toZonedDateTime(timezone),
    end = value.add({ months: 1 }).toPlainDate({ day: 1 }).toZonedDateTime(timezone);
  return {
    month: value.toString(),
    interval: { starts_at: start.toInstant().toString(), ends_at: end.toInstant().toString() },
  };
}
const directorySummary = z.object({
  published: count,
  draft: count,
  occurred: count,
  cancelled: count,
  published_active_registrations: count,
  unresolved_payment_registrations: count,
  pending_payments: z.array(
    z.object({ currency, remaining_minor: money, registration_count: count }),
  ),
});
export async function readEventsPage(
  scope: ClientScope,
  interval: Interval,
  cursor?: string,
  filters: { query?: string; status?: "all" | EventState; includeSummary?: boolean } = {},
  signal?: AbortSignal,
) {
  const backend = await scopedBackend(scope, signal);
  const page = await queryBackendRead(
    backend,
    "event_list_v1",
    {
      ...common(scope),
      request_id: uuidv7(),
      interval,
      ...(filters.query?.trim() ? { query: filters.query.trim() } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.includeSummary ? { include_summary: true } : {}),
      page: { limit: 20, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
    },
    signal,
  );
  if (
    page.items.length > 20 ||
    (cursor && page.next_cursor === cursor) ||
    new Set(page.items.map((row) => row.id)).size !== page.items.length
  )
    throw new Error("EVENT_PAGE_UNAVAILABLE");
  if (filters.includeSummary) {
    directorySummary.parse(page.summary);
    if (
      new Set(page.summary!.pending_payments.map((row) => row.currency)).size !==
      page.summary!.pending_payments.length
    )
      throw new Error("EVENT_SUMMARY_UNAVAILABLE");
    for (const row of page.items) count.parse(row.active_registration_count);
  }
  const items = await Promise.all(page.items.map((row) => validateEvent(row, scope)));
  signal?.throwIfAborted();
  return { ...page, items };
}
export async function readEvent(scope: ClientScope, id: string, includePaymentSummary = false) {
  z.uuid().parse(id);
  const backend = await scopedBackend(scope);
  return validateEvent(
    await backend.call("event_get_v1", {
      ...common(scope),
      request_id: uuidv7(),
      event_id: id,
      ...(includePaymentSummary ? { include_payment_summary: true } : {}),
    }),
    scope,
    id,
  );
}
export async function readEventRooms(scope: ClientScope) {
  const backend = await scopedBackend(scope);
  const rows = await studioPages((cursor) =>
    backend.call("management_state_get_v1", {
      ...common(scope),
      request_id: uuidv7(),
      operation: "room_save_v1",
      selector: { operation: "room_save_v1", key: { include_details: true } },
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    }),
  );
  return rows
    .filter((row) => row.state === "active")
    .map((row) => {
      const values = row.current?.operation === "room_save_v1" ? row.current.values : undefined;
      if (
        !row.exists ||
        row.entity?.type !== "rooms" ||
        values?.room_id !== row.entity.id ||
        !values.name
      )
        throw new Error("EVENT_ROOMS_UNAVAILABLE");
      return { id: z.uuid().parse(row.entity.id), name: values.name, capacity: values.capacity };
    });
}
export async function readEventDisciplines(scope: ClientScope) {
  const backend = await scopedBackend(scope);
  return studioPages((cursor) =>
    backend.call("disciplines_list_v1", {
      ...common(scope),
      request_id: uuidv7(),
      include_presentation: true,
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    }),
  );
}
export async function readEventPeople(scope: ClientScope) {
  const rows = await readStudioInstructors(scope);
  return [
    ...new Map(
      rows
        .filter((row) => row.active)
        .map((row) => [row.person.id, { id: row.person.id, name: row.person.display_name }]),
    ).values(),
  ];
}
export { readProductsPage as readEventProducts };
