import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { getTemporal } from "../../lib/temporal";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { Interval } from "../../lib/api-contracts/generated";

export async function instructorEarningMonths(timezone: string, now: string) {
  const T = await getTemporal();
  const month = T.Instant.from(now).toZonedDateTimeISO(timezone).toPlainDate().toPlainYearMonth();
  return [month, month.subtract({ months: 1 })].map((value) => {
    const start = value.toPlainDate({ day: 1 }).toZonedDateTime(timezone);
    return {
      id: value.toString(),
      label: new Intl.DateTimeFormat("tr-TR", {
        month: "long",
        year: "numeric",
        timeZone: timezone,
      }).format(new Date(start.epochMilliseconds)),
      interval: {
        starts_at: start.toInstant().toString(),
        ends_at: start.add({ months: 1 }).toInstant().toString(),
      },
    };
  });
}

export async function readInstructorEarningPage(
  scope: ClientScope,
  personId: string,
  interval: Interval,
  cursor?: string,
) {
  z.uuid().parse(personId);
  const backend = await scopedBackend(scope);
  const page = await backend.call("earnings_list_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: personId,
    interval,
    page: { limit: 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  const ids = new Set<string>();
  for (const row of page.items) {
    if (
      row.person_id !== personId ||
      row.center_id !== scope.centerId ||
      ids.has(row.id) ||
      !/^[A-Z]{3}$/.test(row.currency) ||
      ![row.amount_minor, row.paid_minor, row.remaining_minor, row.overpaid_minor ?? "0"].every(
        (value) => /^\d+$/.test(value),
      ) ||
      !["add", "subtract"].includes(row.direction) ||
      !Number.isFinite(Date.parse(row.created_at)) ||
      Date.parse(row.created_at) < Date.parse(interval.starts_at) ||
      Date.parse(row.created_at) >= Date.parse(interval.ends_at)
    )
      throw new Error("INSTRUCTOR_EARNINGS_UNAVAILABLE");
    ids.add(z.uuid().parse(row.id));
  }
  if (page.items.length > 20 || (cursor && page.next_cursor === cursor))
    throw new Error("INSTRUCTOR_EARNINGS_UNAVAILABLE");
  return page;
}

const currency = z.string().regex(/^[A-Z]{3}$/);
const money = z.string().regex(/^(0|[1-9]\d*)$/);
const signedMoney = z.string().regex(/^-?(0|[1-9]\d*)$/);
const instant = z.iso.datetime({ offset: true });
const positive = z.number().int().positive().safe();
const payment = z.object({
  id: z.uuid(),
  root_payment_id: z.uuid(),
  version: positive,
  direction: z.enum(["increase", "decrease"]),
  amount_minor: money,
  currency,
  occurred_at: instant,
  method: z.enum(["cash", "bank_transfer", "card_pos"]).nullable(),
  previous_id: z.uuid().nullable(),
});
const total = z.object({
  currency,
  earned_minor: signedMoney,
  paid_minor: signedMoney,
  remaining_minor: money,
  overpaid_minor: money,
});
export async function readInstructorAccount(
  scope: ClientScope,
  personId: string,
  view: "agreements" | "payments",
  interval?: Interval,
  cursor?: string,
) {
  z.uuid().parse(personId);
  const result = await (
    await scopedBackend(scope)
  ).call("instructor_account_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: personId,
    view,
    ...(interval ? { interval: { ...interval } } : {}),
    page: { limit: 20, ...(cursor ? { cursor } : {}) },
  });
  if (result.view !== view || result.items.length > 20 || (cursor && result.next_cursor === cursor))
    throw Error("INSTRUCTOR_ACCOUNT_UNAVAILABLE");
  instant.parse(result.as_of);
  const currencies = new Set<string>(),
    ids = new Set<string>();
  for (const value of result.totals) {
    total.parse(value);
    if (currencies.has(value.currency)) throw Error("INSTRUCTOR_ACCOUNT_UNAVAILABLE");
    currencies.add(value.currency);
  }
  for (const item of result.items) {
    z.uuid().parse(item.id);
    if (ids.has(item.id)) throw Error("INSTRUCTOR_ACCOUNT_UNAVAILABLE");
    ids.add(item.id);
    if (view === "payments") {
      const value = payment.parse(item);
      if (
        (value.previous_id === null && value.root_payment_id !== value.id) ||
        (value.previous_id !== null && value.root_payment_id !== value.previous_id) ||
        (interval &&
          (Date.parse(value.occurred_at) < Date.parse(interval.starts_at) ||
            Date.parse(value.occurred_at) >= Date.parse(interval.ends_at)))
      )
        throw Error("INSTRUCTOR_ACCOUNT_UNAVAILABLE");
    } else {
      if (!("terms" in item) || item.center_id !== scope.centerId)
        throw Error("INSTRUCTOR_ACCOUNT_UNAVAILABLE");
      // The native self reader includes preserved canonical aliases. Their immutable person IDs are not rewritten client-side.
      z.uuid().parse(item.person_id);
      positive.parse(item.version);
      instant.parse(item.valid.starts_at);
      if (item.valid.ends_at) instant.parse(item.valid.ends_at);
      if (
        Date.parse(item.valid.starts_at) > Date.parse(result.as_of) ||
        (item.valid.ends_at && Date.parse(item.valid.ends_at) <= Date.parse(result.as_of))
      )
        throw Error("INSTRUCTOR_ACCOUNT_UNAVAILABLE");
      currency.parse(item.terms.currency);
    }
  }
  return {
    ...result,
    agreements:
      view === "agreements"
        ? result.items.filter(
            (item): item is import("../../lib/api-contracts/generated").AgreementVersionView =>
              "terms" in item,
          )
        : [],
    payments: view === "payments" ? result.items.map((item) => payment.parse(item)) : [],
  };
}
