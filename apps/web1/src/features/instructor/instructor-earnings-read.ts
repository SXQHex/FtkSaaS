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
