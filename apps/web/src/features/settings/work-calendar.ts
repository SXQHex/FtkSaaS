import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { getTemporal } from "../../lib/temporal";
import { readSettingsDocument } from "./settings-document";
import { readClosureContext } from "../studio/closure";
import type { CenterWorkCalendar } from "@ftksaas/api-contracts";

const clock = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const rule = z
  .object({
    weekdays: z
      .tuple([z.number().int().min(1).max(7)])
      .rest(z.number().int().min(1).max(7))
      .refine((days) => days.length <= 7)
      .refine((days) => new Set(days).size === days.length)
      .transform((days) => days.sort((a, b) => a - b)),
    local_start: z.string().regex(clock),
    local_end: z.string().refine((value) => value === "24:00:00" || clock.test(value)),
    valid_from: z.iso.date(),
    valid_until: z.iso.date().nullable().optional().default(null),
  })
  .strict()
  .refine(
    (value) =>
      value.local_start < value.local_end &&
      (!value.valid_until || value.valid_until > value.valid_from),
  );
export const workCalendarSchema = z
  .object({
    rules: z.array(rule).max(100),
    closures: z
      .array(
        z
          .object({
            starts_at: z.iso.datetime({ offset: true }),
            ends_at: z.iso.datetime({ offset: true }),
            reason: z
              .string()
              .min(1)
              .max(2000)
              .refine((value) => value.trim().length > 0),
          })
          .strict()
          .refine((value) => Date.parse(value.starts_at) < Date.parse(value.ends_at)),
      )
      .max(200),
  })
  .strict()
  .nullable();
export type WorkCalendarValue = CenterWorkCalendar | null;
const same = (a: WorkCalendarValue, b: WorkCalendarValue) =>
  JSON.stringify(workCalendarSchema.parse(a)) === JSON.stringify(workCalendarSchema.parse(b));
export async function readWorkCalendar(scope: ClientScope, readContext?: AccountReadContext) {
  const [source, context] = await Promise.all([
    readSettingsDocument(scope, "center", readContext),
    readClosureContext(scope, readContext),
  ]);
  if (
    !Object.hasOwn(source.document.values, "work_calendar") ||
    !source.catalog.fields.some((field) => field.key === "work_calendar")
  )
    throw Error("WORK_CALENDAR_UNAVAILABLE");
  const calendar: WorkCalendarValue = workCalendarSchema.parse(
    source.document.values.work_calendar,
  );
  return {
    scope: { ...scope },
    calendar,
    version: source.document.version,
    timezone: context.center.timezone,
    writable: source.catalog.fields.some(
      (field) => field.key === "work_calendar" && field.writable,
    ),
  };
}
export type WorkCalendarSource = Awaited<ReturnType<typeof readWorkCalendar>>;
export interface WorkCalendarIntent {
  before: WorkCalendarSource;
  calendar: WorkCalendarValue;
  key: string;
}
export async function prepareWorkCalendar(
  before: WorkCalendarSource,
  value: unknown,
): Promise<WorkCalendarIntent> {
  const calendar: WorkCalendarValue = workCalendarSchema.parse(value),
    T = await getTemporal();
  for (const row of calendar?.rules ?? []) {
    T.PlainDate.from(row.valid_from);
    if (row.valid_until) T.PlainDate.from(row.valid_until);
    T.PlainTime.from(row.local_start);
    if (row.local_end !== "24:00:00") T.PlainTime.from(row.local_end);
  }
  const current = await readWorkCalendar(before.scope);
  if (!current.writable)
    throw new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: uuidv7() });
  if (
    current.version !== before.version ||
    current.timezone !== before.timezone ||
    !same(current.calendar, before.calendar)
  )
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  if (same(current.calendar, calendar)) throw Error("WORK_CALENDAR_UNCHANGED");
  const { scope } = before,
    backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "settings_update_v1",
    selector: {
      operation: "settings_update_v1",
      key: { scope: "center", work_calendar: calendar },
    },
    page: { limit: 1 },
  });
  const row = page.items[0];
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !row?.exists ||
    row.operation !== "settings_update_v1" ||
    row.entity?.type !== "centers" ||
    row.entity.id !== scope.centerId ||
    row.current?.operation !== "settings_update_v1" ||
    row.current.values.scope !== "center" ||
    row.current.values.settings_version !== current.version ||
    !same(row.current.values.work_calendar, calendar)
  )
    throw Error("WORK_CALENDAR_IMPACT_UNAVAILABLE");
  const impact = row.current.values.work_calendar_impact;
  if (
    !Number.isSafeInteger(impact.count) ||
    impact.count < 0 ||
    typeof impact.truncated !== "boolean" ||
    !Array.isArray(impact.sessions)
  )
    throw Error("WORK_CALENDAR_IMPACT_UNAVAILABLE");
  if (impact.count > 0 || impact.truncated || impact.sessions.length)
    throw new BackendError({ code: "OPEN_OPERATIONS_EXIST", retryable: false, trace_id: uuidv7() });
  return { before: structuredClone(current), calendar, key: uuidv7() };
}
export async function writeWorkCalendar(intent: WorkCalendarIntent) {
  const { scope } = intent.before;
  return (await scopedBackend(scope)).call("settings_update_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    scope: "center",
    expected_version: intent.before.version,
    operation_key: intent.key,
    patch: { work_calendar: intent.calendar },
  });
}
export async function readWorkCalendarReceipt(intent: WorkCalendarIntent) {
  const { scope } = intent.before;
  const receipt = await (
    await scopedBackend(scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    operation: "settings_update_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "settings_update_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== "accounts" ||
        receipt.result_reference.id !== scope.accountId))
  )
    throw Error("WORK_CALENDAR_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readWorkCalendarResult(intent: WorkCalendarIntent, id?: string) {
  if (id !== intent.before.scope.accountId) throw Error("WORK_CALENDAR_RESULT_UNAVAILABLE");
  const source = await readWorkCalendar(intent.before.scope);
  if (source.version <= intent.before.version || !same(source.calendar, intent.calendar))
    throw Error("WORK_CALENDAR_RESULT_UNAVAILABLE");
  return source;
}

export const workCalendarDays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
