import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { EventView, RequestEventSave } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import { scheduleTimeChoices, ScheduleTimeError } from "../schedule/schedule-time";
import { readEvent } from "./events-read";
import { emptyEventDraft, type EventDraft } from "./event-draft";

export interface EventSaveIntent {
  scope: ClientScope;
  operation: "event_save_v1";
  request: Omit<RequestEventSave, "request_id">;
  before?: EventView;
}
const integer = (value: string) =>
  z
    .number()
    .int()
    .nonnegative()
    .safe()
    .parse(Number(z.string().regex(/^\d+$/).parse(value)));
const money = (value: string) => BigInt(z.string().regex(/^\d+$/).parse(value)).toString();
const currency = (value: string) =>
  z
    .string()
    .regex(/^[A-Z]{3}$/)
    .parse(value);
function unique(values: string[]) {
  const result = z.array(z.uuid()).parse(values);
  if (new Set(result).size !== result.length) throw new Error("EVENT_INVALID");
  return result;
}
export async function eventDraft(before?: EventView, timezone = ""): Promise<EventDraft> {
  if (!before) return { ...emptyEventDraft, timezone };
  if (before.assignments.length && !before.assignment_terms)
    throw new Error("EVENT_DUTIES_UNAVAILABLE");
  const T = await getTemporal(),
    start = T.Instant.from(before.interval.starts_at).toZonedDateTimeISO(before.timezone),
    end = T.Instant.from(before.interval.ends_at).toZonedDateTimeISO(before.timezone);
  const unlimited = "kind" in before.capacity;
  const duties = before.assignment_terms ?? [];
  if (
    duties.length !== before.assignments.length ||
    duties.some(
      (row) =>
        !before.assignments.some(
          (assignment) => assignment.person_id === row.person_id && assignment.duty === row.duty,
        ),
    )
  )
    throw new Error("EVENT_DUTIES_UNAVAILABLE");
  return {
    ...emptyEventDraft,
    name: before.name,
    kind: before.terms.package_usage === "eligibility_only" ? "practice" : "workshop",
    disciplineIds: [...before.discipline_ids],
    timezone: before.timezone,
    starts: start.toPlainDateTime().toString({ smallestUnit: "minute" }),
    ends: end.toPlainDateTime().toString({ smallestUnit: "minute" }),
    startOffset: start.offset,
    endOffset: end.offset,
    venueKind: before.venue.kind,
    roomId: before.venue.room_id ?? "",
    venueName: before.venue.name ?? "",
    address: before.venue.address ?? "",
    nominal: "kind" in before.capacity ? "" : String(before.capacity.nominal),
    maximum: "kind" in before.capacity ? "" : String(before.capacity.maximum),
    unlimited,
    fee: before.terms.fee_minor,
    currency: before.terms.currency,
    fullPayment: before.terms.full_payment_required,
    productIds: [...before.terms.allowed_product_version_ids],
    cutoff:
      before.terms.cancellation.cutoff_minutes === null ||
      before.terms.cancellation.cutoff_minutes === undefined
        ? ""
        : String(before.terms.cancellation.cutoff_minutes),
    before: before.terms.cancellation.before_cutoff,
    after: before.terms.cancellation.after_cutoff,
    noShow: before.terms.cancellation.no_show,
    refund: before.terms.refund.method,
    usedUnit: before.terms.refund.used_unit_minor ?? "",
    duties: duties.map((row) => ({
      personId: row.person_id,
      duty: row.duty,
      fee: row.fee_minor,
      currency: row.currency,
    })),
    reviewed: false,
  };
}
async function eventInstant(draft: EventDraft, kind: "starts" | "ends", before?: EventView) {
  const T = await getTemporal(),
    field = kind === "starts" ? "starts_at" : "ends_at",
    chosenOffset = kind === "starts" ? draft.startOffset : draft.endOffset;
  if (before && before.timezone === draft.timezone) {
    const original = T.Instant.from(before.interval[field]).toZonedDateTimeISO(before.timezone);
    if (
      original.toPlainDateTime().toString({ smallestUnit: "minute" }) === draft[kind] &&
      original.offset === chosenOffset
    )
      return before.interval[field];
  }
  return eventWallInstant(draft.timezone, draft[kind], chosenOffset, kind);
}
export async function eventWallInstant(
  timezone: string,
  value: string,
  offset: string,
  label = "actual",
) {
  const T = await getTemporal();
  const [date, time] = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .parse(value)
    .split("T") as [string, string];
  const { local, offsets } = await scheduleTimeChoices(timezone, date, time);
  if (offsets.length && !offsets.includes(offset))
    throw new ScheduleTimeError("SCHEDULE_TIME_AMBIGUOUS", [
      { date: label, choices: offsets.map((offset) => ({ id: offset, label: `UTC${offset}` })) },
    ]);
  return T.ZonedDateTime.from(
    {
      timeZone: timezone,
      year: local.year,
      month: local.month,
      day: local.day,
      hour: local.hour,
      minute: local.minute,
      ...(offsets.length ? { offset } : {}),
    },
    { disambiguation: "reject", offset: "reject", overflow: "reject" },
  )
    .toInstant()
    .toString();
}
export async function eventSaveIntent(
  scope: ClientScope,
  draft: EventDraft,
  before?: EventView,
): Promise<EventSaveIntent> {
  if (!draft.reviewed) throw new Error("EVENT_REVIEW_REQUIRED");
  const T = await getTemporal();
  const interval = {
    starts_at: await eventInstant(draft, "starts", before),
    ends_at: await eventInstant(draft, "ends", before),
  };
  if (T.Instant.compare(interval.starts_at, interval.ends_at) >= 0)
    throw new Error("EVENT_INVALID");
  const products = unique(draft.productIds),
    disciplines = unique(draft.disciplineIds);
  if (draft.kind === "practice" && (!products.length || BigInt(money(draft.fee)) !== 0n))
    throw new Error("EVENT_INVALID");
  const capacity = draft.unlimited
    ? { kind: "unlimited" as const }
    : { nominal: integer(draft.nominal), maximum: integer(draft.maximum) };
  if (
    (draft.unlimited && draft.venueKind !== "external") ||
    (!("kind" in capacity) && capacity.maximum < capacity.nominal)
  )
    throw new Error("EVENT_INVALID");
  const preserved =
    before?.venue.kind === "external" &&
    draft.venueKind === "external" &&
    before.venue.address === draft.address &&
    before.venue.name === draft.venueName
      ? { latitude: before.venue.latitude, longitude: before.venue.longitude }
      : {};
  const venueTimezone =
    before &&
    before.timezone === draft.timezone &&
    before.venue.kind === draft.venueKind &&
    (draft.venueKind === "internal"
      ? before.venue.room_id === draft.roomId
      : before.venue.address === draft.address)
      ? before.venue.timezone
      : draft.timezone;
  const request: Omit<RequestEventSave, "request_id"> = {
    client_api_version: 1,
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation_key: uuidv7(),
    ...(before ? { event_id: before.id, expected_version: before.version } : {}),
    name: z.string().trim().min(1).parse(draft.name),
    interval,
    timezone: draft.timezone,
    venue:
      draft.venueKind === "internal"
        ? { kind: "internal", room_id: z.uuid().parse(draft.roomId), timezone: venueTimezone }
        : {
            kind: "external",
            name: z.string().trim().min(1).parse(draft.venueName),
            address: z.string().trim().min(1).parse(draft.address),
            timezone: venueTimezone,
            ...preserved,
          },
    capacity,
    discipline_ids: disciplines,
    terms: {
      fee_minor: money(draft.fee),
      currency: currency(draft.currency),
      full_payment_required: draft.fullPayment,
      allowed_product_version_ids: products,
      ...(draft.kind === "practice"
        ? { package_usage: "eligibility_only" as const }
        : before?.terms.package_usage === "consume"
          ? { package_usage: "consume" as const }
          : {}),
      cancellation: {
        ...(draft.cutoff ? { cutoff_minutes: integer(draft.cutoff) } : {}),
        before_cutoff: z.enum(["release", "consume"]).parse(draft.before),
        after_cutoff: z.enum(["release", "consume"]).parse(draft.after),
        no_show: z.enum(["release", "consume"]).parse(draft.noShow),
      },
      refund: {
        method: z
          .enum(["none", "credit_ratio", "used_at_unit_price", "time_ratio"])
          .parse(draft.refund),
        ...(draft.refund === "used_at_unit_price"
          ? { used_unit_minor: money(draft.usedUnit) }
          : {}),
      },
    },
    assignments: draft.duties.map((row) => ({
      person_id: z.uuid().parse(row.personId),
      duty: row.duty,
      fee_minor: money(row.fee),
      currency: currency(row.currency),
    })),
  };
  if (
    new Set(request.assignments.map((row) => `${row.person_id}:${row.duty}`)).size !==
    request.assignments.length
  )
    throw new Error("EVENT_INVALID");
  if (before) {
    const current = await readEvent(scope, before.id);
    if (
      current.version !== before.version ||
      !["draft", "published"].includes(current.state) ||
      current.attendance_state !== "open"
    )
      throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  }
  return { scope: { ...scope }, operation: "event_save_v1", request, before };
}
export async function writeEventIntent(intent: EventSaveIntent) {
  return (await scopedBackend(intent.scope)).call(intent.operation, {
    ...intent.request,
    request_id: uuidv7(),
  });
}
export async function readEventReceipt(intent: EventSaveIntent) {
  const receipt = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  if (
    receipt.operation !== intent.operation ||
    receipt.key !== intent.request.operation_key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== "events" ||
        (intent.before && receipt.result_reference.id !== intent.before.id)))
  )
    throw new Error("EVENT_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readEventResult(intent: EventSaveIntent, id?: string) {
  const primary = z.uuid().parse(id),
    result = await readEvent(intent.scope, primary),
    request = intent.request;
  const T = await getTemporal();
  const sorted = (values: string[]) => [...values].sort().join();
  if (
    (intent.before && primary !== intent.before.id) ||
    result.name !== request.name ||
    result.state !== (intent.before?.state ?? "draft") ||
    (intent.before && result.version <= intent.before.version) ||
    result.timezone !== request.timezone ||
    T.Instant.compare(result.interval.starts_at, request.interval.starts_at) !== 0 ||
    T.Instant.compare(result.interval.ends_at, request.interval.ends_at) !== 0 ||
    result.venue.kind !== request.venue.kind ||
    result.venue.timezone !== request.venue.timezone ||
    (result.venue.room_id !== request.venue.room_id &&
      !(result.venue.room_id == null && request.venue.room_id == null)) ||
    (request.venue.kind === "external" &&
      (result.venue.name !== request.venue.name ||
        result.venue.address !== request.venue.address)) ||
    sorted(result.discipline_ids) !== sorted(request.discipline_ids) ||
    ("kind" in result.capacity
      ? !("kind" in request.capacity)
      : "kind" in request.capacity ||
        result.capacity.nominal !== request.capacity.nominal ||
        result.capacity.maximum !== request.capacity.maximum) ||
    result.terms.fee_minor !== request.terms.fee_minor ||
    result.terms.currency !== request.terms.currency ||
    result.terms.full_payment_required !== request.terms.full_payment_required ||
    sorted(result.terms.allowed_product_version_ids) !==
      sorted(request.terms.allowed_product_version_ids) ||
    (result.terms.package_usage ?? "consume") !== (request.terms.package_usage ?? "consume") ||
    result.terms.cancellation.before_cutoff !== request.terms.cancellation.before_cutoff ||
    result.terms.cancellation.after_cutoff !== request.terms.cancellation.after_cutoff ||
    result.terms.cancellation.no_show !== request.terms.cancellation.no_show ||
    (result.terms.cancellation.cutoff_minutes ?? null) !==
      (request.terms.cancellation.cutoff_minutes ?? null) ||
    result.terms.refund.method !== request.terms.refund.method ||
    (result.terms.refund.used_unit_minor ?? null) !==
      (request.terms.refund.used_unit_minor ?? null) ||
    sorted(result.assignments.map((row) => `${row.person_id}:${row.duty}`)) !==
      sorted(request.assignments.map((row) => `${row.person_id}:${row.duty}`)) ||
    sorted(
      (result.assignment_terms ?? []).map(
        (row) => `${row.person_id}:${row.duty}:${row.fee_minor}:${row.currency}`,
      ),
    ) !==
      sorted(
        request.assignments.map(
          (row) => `${row.person_id}:${row.duty}:${row.fee_minor}:${row.currency}`,
        ),
      )
  )
    throw new Error("EVENT_RESULT_UNREAD");
  return result;
}
