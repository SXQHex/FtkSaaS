import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { queryBackendRead } from "../../lib/backend";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import { formatMinorAmount } from "../../lib/money";
import type {
  FinanceDirectoryEntry,
  FinanceDirectoryTotal,
  Interval,
  RequestFinanceDirectoryGet,
} from "@ftksaas/api-contracts";

export type DirectoryKind = NonNullable<RequestFinanceDirectoryGet["kind"]>;
export type DirectoryMethod = NonNullable<RequestFinanceDirectoryGet["method"]>;
export interface FinancePeriod {
  startDate: string;
  endDate: string;
  interval: Interval;
}
export async function financePeriod(
  timezone: string,
  from?: string,
  through?: string,
): Promise<FinancePeriod> {
  const T = await getTemporal(),
    today = T.Now.instant().toZonedDateTimeISO(timezone).toPlainDate();
  const start = from ? T.PlainDate.from(from) : today.with({ day: 1 }),
    end = through ? T.PlainDate.from(through) : today;
  if (T.PlainDate.compare(start, end) > 0) throw new Error("FINANCE_PERIOD_INVALID");
  const duration =
    end.add({ days: 1 }).toZonedDateTime(timezone).epochMilliseconds -
    start.toZonedDateTime(timezone).epochMilliseconds;
  if (duration > 366 * 86400000) throw new Error("FINANCE_PERIOD_INVALID");
  return {
    startDate: start.toString(),
    endDate: end.toString(),
    interval: {
      starts_at: start.toZonedDateTime(timezone).toInstant().toString(),
      ends_at: end.add({ days: 1 }).toZonedDateTime(timezone).toInstant().toString(),
    },
  };
}
export function financeDirectoryRowKey(row: FinanceDirectoryEntry) {
  return `${row.entity.type}:${row.id}:${row.kind}:${row.currency}`;
}
export async function readFinanceDirectory(
  scope: ClientScope,
  view: "movements" | "debts" | "credits",
  interval: Interval,
  filters: { query?: string; kind?: DirectoryKind; method?: DirectoryMethod } = {},
  cursor?: string,
  signal?: AbortSignal,
  readContext?: AccountReadContext,
  limit: 1 | 20 = 20,
) {
  const backend = await scopedBackend(scope, signal, readContext);
  const data = await queryBackendRead(
    backend,
    "finance_directory_get_v1",
    {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      view,
      interval: { ...interval },
      ...(filters.query?.trim() ? { query: filters.query.trim() } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.method ? { method: filters.method } : {}),
      page: { limit, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    },
    signal,
  );
  if (data.view !== view || data.items.length > limit || (cursor && data.next_cursor === cursor))
    throw new Error("FINANCE_DIRECTORY_UNAVAILABLE");
  z.iso.datetime({ offset: true }).parse(data.as_of);
  const ids = new Set<string>();
  for (const row of data.items) {
    z.uuid().parse(row.id);
    z.uuid().parse(row.person_id);
    z.number().int().positive().safe().parse(row.version);
    z.string()
      .regex(/^(0|[1-9][0-9]{0,18})$/)
      .refine((value) => BigInt(value) <= 9223372036854775807n)
      .parse(row.amount_minor);
    z.string()
      .regex(/^[A-Z]{3}$/)
      .parse(row.currency);
    z.iso.datetime({ offset: true }).parse(row.created_at);
    z.iso.datetime({ offset: true }).parse(row.occurred_at);
    if (row.source_sale_id) z.uuid().parse(row.source_sale_id);
    if (row.due_at) z.iso.datetime({ offset: true }).parse(row.due_at);
    const type =
      row.kind === "sale"
        ? "sales"
        : row.kind === "debt"
          ? "debts"
          : row.kind === "credit"
            ? "people"
            : "cash_movements";
    if (
      row.entity.type !== type ||
      row.entity.id !== row.id ||
      (row.kind === "sale" && row.source_sale_id !== row.id) ||
      ids.has(financeDirectoryRowKey(row)) ||
      (view === "debts" && row.kind !== "debt") ||
      (view === "credits" && row.kind !== "credit") ||
      (view === "movements" && ["debt", "credit"].includes(row.kind)) ||
      (filters.kind && row.kind !== filters.kind) ||
      (filters.method && row.method !== filters.method)
    )
      throw new Error("FINANCE_DIRECTORY_UNAVAILABLE");
    if (
      view === "movements" &&
      (Date.parse(row.occurred_at) < Date.parse(interval.starts_at) ||
        Date.parse(row.occurred_at) >= Date.parse(interval.ends_at))
    )
      throw new Error("FINANCE_DIRECTORY_UNAVAILABLE");
    ids.add(financeDirectoryRowKey(row));
  }
  const currencies = new Set<string>();
  for (const total of data.totals) {
    z.string()
      .regex(/^[A-Z]{3}$/)
      .parse(total.currency);
    if (currencies.has(total.currency)) throw new Error("FINANCE_DIRECTORY_TOTALS_UNAVAILABLE");
    currencies.add(total.currency);
    for (const key of [
      "sales_minor",
      "collections_minor",
      "refunds_minor",
      "debt_minor",
      "credit_minor",
    ] as const)
      z.string()
        .regex(/^(0|-?[1-9][0-9]*)$/)
        .parse(total[key]);
    for (const key of ["debt_people", "credit_people"] as const)
      z.number().int().nonnegative().safe().parse(total[key]);
  }
  signal?.throwIfAborted();
  return data;
}
export function financeDirectoryTotal(
  totals: FinanceDirectoryTotal[],
  field: "sales_minor" | "collections_minor" | "debt_minor" | "credit_minor",
) {
  return totals.length
    ? totals
        .map((row) => `${row.currency} ${formatMinorAmount(row[field], row.currency)}`)
        .join(" · ")
    : null;
}
