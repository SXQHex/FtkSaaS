import { getTemporal } from "../../lib/temporal";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { Interval, InstructorAccountTotal } from "@ftksaas/api-contracts";
export type EarningsDirectoryView = "instructors" | "earnings" | "payments";
const instant = z.iso.datetime({ offset: true });
const currency = z.string().regex(/^[A-Z]{3}$/);
const money = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((value) => BigInt(value) <= 9223372036854775807n);
const signedMoney = z
  .string()
  .regex(/^(0|-?[1-9][0-9]{0,18})$/)
  .refine(
    (value) => BigInt(value) >= -9223372036854775808n && BigInt(value) <= 9223372036854775807n,
  );
const positive = z.number().int().positive().safe();
function validateTotals(totals: InstructorAccountTotal[]) {
  const currencies = new Set<string>();
  for (const total of totals) {
    currency.parse(total.currency);
    signedMoney.parse(total.earned_minor);
    signedMoney.parse(total.paid_minor);
    money.parse(total.remaining_minor);
    money.parse(total.overpaid_minor);
    if (currencies.has(total.currency)) throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
    currencies.add(total.currency);
  }
}
export async function readEarningsDirectory(
  scope: ClientScope,
  view: EarningsDirectoryView,
  input: { personId?: string; interval?: Interval; cursor?: string } = {},
) {
  const temporal = await getTemporal();
  if (input.personId) z.uuid().parse(input.personId);
  if (input.interval) {
    instant.parse(input.interval.starts_at);
    instant.parse(input.interval.ends_at);
    if (temporal.Instant.compare(input.interval.starts_at, input.interval.ends_at) >= 0)
      throw new Error("EARNINGS_INTERVAL_INVALID");
  }
  const data = await (
    await scopedBackend(scope)
  ).call("instructor_finance_directory_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    view,
    ...(input.personId ? { person_id: input.personId } : {}),
    ...(input.interval ? { interval: { ...input.interval } } : {}),
    page: { limit: 20, ...(input.cursor ? { cursor: input.cursor } : {}) },
  });
  if (
    data.view !== view ||
    data.items.length > 20 ||
    (input.cursor && data.next_cursor === input.cursor)
  )
    throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
  instant.parse(data.as_of);
  z.number().int().nonnegative().safe().parse(data.closed_session_count);
  validateTotals(data.totals);
  const ids = new Set<string>();
  for (const row of data.items) {
    const kind =
      view === "instructors" ? "instructor" : view === "earnings" ? "earning" : "payment";
    if (row.kind !== kind) throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
    z.string().parse(row.display_name);
    const id =
      row.kind === "instructor" ? row.person_id : row.kind === "earning" ? row.earning.id : row.id;
    z.uuid().parse(id);
    if (ids.has(id)) throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
    ids.add(id);
    if (row.kind === "instructor") {
      if (input.personId && row.person_id !== input.personId)
        throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
      validateTotals(row.totals);
      const agreementIds = new Set(row.agreement_ids);
      if (
        agreementIds.size !== row.agreement_ids.length ||
        new Set(row.current_agreement_ids).size !== row.current_agreement_ids.length
      )
        throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
      row.agreement_ids.forEach((value) => z.uuid().parse(value));
      if (row.current_agreement_ids.some((value) => !agreementIds.has(value)))
        throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
    } else if (row.kind === "earning") {
      const item = row.earning;
      z.uuid().parse(item.person_id);
      positive.parse(item.version);
      currency.parse(item.currency);
      for (const value of [
        item.amount_minor,
        item.paid_minor,
        item.remaining_minor,
        item.overpaid_minor ?? "0",
      ])
        money.parse(value);
      instant.parse(item.created_at);
      // Immutable person IDs can be historical aliases; the backend owns canonical person filtering.
      if (
        item.center_id !== scope.centerId ||
        item.basis.currency !== item.currency ||
        !["add", "subtract"].includes(item.direction)
      )
        throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
      for (const value of [
        item.session_id,
        item.event_assignment_id,
        item.previous_id,
        item.closure_id,
        row.agreement_id,
      ])
        if (value !== null) z.uuid().parse(value);
      if (row.agreement_version !== null) positive.parse(row.agreement_version);
      if ((row.agreement_id === null) !== (row.agreement_version === null))
        throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
      if (
        input.interval &&
        (temporal.Instant.compare(item.created_at, input.interval.starts_at) < 0 ||
          temporal.Instant.compare(item.created_at, input.interval.ends_at) >= 0)
      )
        throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
    } else {
      z.uuid().parse(row.person_id);
      z.uuid().parse(row.root_payment_id);
      positive.parse(row.version);
      if (row.previous_id !== null) z.uuid().parse(row.previous_id);
      money.parse(row.amount_minor);
      currency.parse(row.currency);
      instant.parse(row.occurred_at);
      if (
        !["increase", "decrease"].includes(row.direction) ||
        (row.previous_id === null && row.root_payment_id !== row.id) ||
        (row.previous_id !== null && row.previous_id !== row.root_payment_id)
      )
        throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
      if (
        row.payment &&
        (!["bank_transfer", "cash", "card_pos"].includes(row.payment.method) ||
          (row.payment.reference != null && typeof row.payment.reference !== "string"))
      )
        throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
      if (
        input.interval &&
        (temporal.Instant.compare(row.occurred_at, input.interval.starts_at) < 0 ||
          temporal.Instant.compare(row.occurred_at, input.interval.ends_at) >= 0)
      )
        throw new Error("EARNINGS_SOURCE_UNAVAILABLE");
    }
  }
  return data;
}
