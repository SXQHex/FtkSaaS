import type { TFunction } from "i18next";
import type { ReportTotal, ReportView } from "@ftksaas/api-contracts";
import { formatMinorAmount } from "../../lib/money";
import { reportRowKey } from "./reports-read";
import type { ReportChartPoint, ReportRow } from "./reports-view";
export function reportMoney(totals: ReportTotal[], metric: string) {
  const amounts = new Map<string, bigint>();
  for (const row of totals)
    if (row.group_key?.startsWith(metric) && row.currency && row.amount_minor != null)
      amounts.set(row.currency, (amounts.get(row.currency) ?? 0n) + BigInt(row.amount_minor));
  return [...amounts]
    .map(([currency, value]) => formatMinorAmount(value.toString(), currency))
    .join(" · ");
}
export function reportCount(totals: ReportTotal[], metric: string) {
  return totals
    .filter((row) => row.group_key?.startsWith(metric))
    .reduce((sum, row) => sum + BigInt(row.count), 0n)
    .toLocaleString("tr-TR");
}
export function reportRatio(value: number | null | undefined, unknown: string) {
  return value == null
    ? unknown
    : new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 2 }).format(
        value / 10000,
      );
}
export function salesPoints(
  data: ReportView,
  kind: "week" | "product",
  t: TFunction,
): ReportChartPoint[] {
  // One point per actual currency and bucket. The bar is relative; exact money stays a string.
  const rows = data.rows.items;
  const max = rows.reduce(
    (value, row) =>
      row.amount_minor != null && BigInt(row.amount_minor) > value
        ? BigInt(row.amount_minor)
        : value,
    0n,
  );
  return rows.map((row) => ({
    id: reportRowKey(row),
    label: `${kind === "week" ? (row.period_start ?? t(($) => $.reports.unknown)) : (row.product_name ?? t(($) => $.reports.unallocated))} · ${row.currency ?? ""}`,
    value:
      row.amount_minor != null && max > 0n
        ? Number((BigInt(row.amount_minor) * 10000n) / max) / 100
        : 0,
    display:
      row.currency && row.amount_minor != null
        ? formatMinorAmount(row.amount_minor, row.currency)
        : t(($) => $.reports.unknown),
  }));
}
export function sessionRows(data: ReportView, t: TFunction): ReportRow[] {
  return data.rows.items.map((row) => ({
    id: reportRowKey(row),
    cells: [
      row.session_name ?? t(($) => $.reports.unknown),
      t(
        ($) =>
          $.reports.metricNames[row.group_key === "occupancy" ? "occupancy" : "closed_attendance"],
      ),
      row.group_key === "occupancy"
        ? reportRatio(
            row.ratio_bps,
            t(($) => $.reports.noDenominator),
          )
        : t(($) => $.reports.unknown),
      row.group_key === "closed_attendance"
        ? reportRatio(
            row.ratio_bps,
            t(($) => $.reports.noDenominator),
          )
        : t(($) => $.reports.unknown),
    ],
  }));
}
export function instructorRows(data: ReportView, t: TFunction): ReportRow[] {
  const unknown = t(($) => $.reports.unknown);
  return data.rows.items.map((row) => ({
    id: reportRowKey(row),
    cells: [
      `${row.display_name ?? unknown} · ${t(($) => $.reports.metricNames[row.group_key as "earning_accrual" | "instructor_paid" | "instructor_remaining" | "instructor_overpaid" | "closed_sessions"])}`,
      row.group_key === "closed_sessions"
        ? (row.count?.toLocaleString("tr-TR") ?? unknown)
        : unknown,
      ...["earning_accrual", "instructor_paid", "instructor_remaining"].map((metric) =>
        row.group_key === metric && row.currency && row.amount_minor != null
          ? formatMinorAmount(row.amount_minor, row.currency)
          : unknown,
      ),
    ],
  }));
}
export function collectionRows(
  data: ReportView,
  kind: "person" | "product",
  t: TFunction,
): ReportRow[] {
  return data.rows.items.map((row) => ({
    id: reportRowKey(row),
    cells: [
      (kind === "person" ? row.display_name : row.product_name) ?? t(($) => $.reports.unallocated),
      row.count?.toLocaleString("tr-TR") ?? t(($) => $.reports.unknown),
      row.currency && row.amount_minor != null
        ? formatMinorAmount(row.amount_minor, row.currency)
        : t(($) => $.reports.unknown),
    ],
  }));
}
