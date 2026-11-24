import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ftksaas/ui/components/table";
import type {
  CenterView,
  Interval,
  ReportFilters,
  ReportRow,
  ReportTotal,
} from "@ftksaas/api-contracts";
import { formatMinorAmount } from "../../lib/money";
import type { ClientScope, AccountReadContext } from "../../lib/scoped-backend";
import { readScopedReport, reportInterval, reportRowKey } from "../reports/reports-read";

const metrics = ["sales", "collections", "debt"] as const;
type Amounts = Map<string, bigint>;
type Finance = Record<(typeof metrics)[number], Amounts>;

type ReportAmount = Pick<ReportTotal, "group_key" | "currency" | "amount_minor">;

function groupAmounts(rows: ReportAmount[]) {
  const result: Amounts = new Map();
  for (const row of rows) {
    if (!row.currency || row.amount_minor == null) throw Error("BUSINESS_FINANCE_TOTAL_INVALID");
    result.set(row.currency, (result.get(row.currency) ?? 0n) + BigInt(row.amount_minor));
  }
  return result;
}

function financeAmounts(sales: ReportAmount[], receivables: ReportAmount[]): Finance {
  return {
    sales: groupAmounts(sales.filter((row) => row.group_key?.startsWith("gross_sales:"))),
    collections: groupAmounts(receivables.filter((row) => row.group_key === "collections")),
    debt: groupAmounts(receivables.filter((row) => row.group_key === "outstanding_debt")),
  };
}

async function readCenterFinance(
  scope: ClientScope,
  interval: Interval,
  readContext: AccountReadContext,
) {
  const filters = { interval, center_ids: [scope.centerId] };
  const [sales, receivables] = await Promise.all([
    readScopedReport(scope, "sales", filters, { limit: 1 }, readContext),
    readScopedReport(scope, "collections_debts", filters, { limit: 1 }, readContext),
  ]);
  return financeAmounts(sales.totals, receivables.totals);
}

async function readGroupedFinance(
  scope: ClientScope,
  report: "sales" | "collections_debts",
  filters: ReportFilters,
  readContext: AccountReadContext,
) {
  const cursors = new Set<string>();
  const keys = new Set<string>();
  const byCenter = new Map<string, ReportRow[]>();
  const options = {
    aggregate: true,
    limit: 200,
    groupBy: report === "collections_debts" ? ("center" as const) : undefined,
  };
  const first = await readScopedReport(scope, report, filters, options, readContext);
  let page = first;
  while (true) {
    for (const row of page.rows.items) {
      if (!row.center_id || row.person_id || keys.has(reportRowKey(row)))
        throw Error("BUSINESS_FINANCE_SOURCE_INVALID");
      keys.add(reportRowKey(row));
      const rows = byCenter.get(row.center_id);
      if (rows) rows.push(row);
      else byCenter.set(row.center_id, [row]);
    }
    const cursor = page.rows.next_cursor;
    if (!cursor) return { byCenter, totals: first.totals };
    if (cursors.has(cursor)) throw Error("BUSINESS_FINANCE_SOURCE_INVALID");
    cursors.add(cursor);
    page = await readScopedReport(scope, report, filters, { ...options, cursor }, readContext);
  }
}

function formatAmounts(values: Amounts) {
  return [...values]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, value]) => formatMinorAmount(value.toString(), currency))
    .join(" · ");
}

export function BusinessFinanceReport({
  scope,
  centers,
  aggregate,
  range,
  timezone,
  anchor,
}: {
  scope: ClientScope;
  centers: CenterView[];
  aggregate: boolean;
  range: "7" | "30" | "90";
  timezone: string;
  anchor: string;
}) {
  const { t } = useTranslation();
  const labels = t(($) => $.businessCenters.reportFinance, { returnObjects: true });
  const centerIds = centers.map((center) => center.id);
  const query = useQuery({
    queryKey: ["business-finance-report", scope, centerIds, aggregate, range, timezone, anchor],
    queryFn: async (context) => {
      const { signal } = context;
      const interval = await reportInterval(timezone, range, "", "", anchor);
      if (aggregate) {
        const filters = { interval, center_ids: centerIds };
        const [sales, receivables] = await Promise.all([
          readGroupedFinance(scope, "sales", filters, context),
          readGroupedFinance(scope, "collections_debts", filters, context),
        ]);
        return {
          rows: centerIds.map((id) => ({
            id,
            amounts: financeAmounts(
              sales.byCenter.get(id) ?? [],
              receivables.byCenter.get(id) ?? [],
            ),
          })),
          total: financeAmounts(sales.totals, receivables.totals),
        };
      }
      const rows = [];
      for (const centerId of centerIds) {
        signal.throwIfAborted();
        rows.push({
          id: centerId,
          amounts: await readCenterFinance({ ...scope, centerId }, interval, context),
        });
      }
      return { rows, total: undefined };
    },
    retry: false,
    gcTime: 0,
  });
  if (query.isPending) return <p role="status">{t(($) => $.platform.loading)}</p>;
  if (query.isError)
    return (
      <Alert variant="destructive">
        <AlertDescription className="space-y-2">
          <p>{labels.error}</p>
          <Button variant="outline" onPress={() => void query.refetch()}>
            {t(($) => $.auth.retry)}
          </Button>
        </AlertDescription>
      </Alert>
    );
  const { rows, total } = query.data;
  const unmatched = total
    ? metrics
        .map((metric) => {
          const differences = new Map(total[metric]);
          for (const row of rows) {
            for (const [currency, amount] of row.amounts[metric])
              differences.set(currency, (differences.get(currency) ?? 0n) - amount);
          }
          return {
            metric,
            amounts: new Map([...differences].filter(([, amount]) => amount !== 0n)),
          };
        })
        .filter((row) => row.amounts.size)
    : [];
  const name = (id: string) => centers.find((center) => center.id === id)?.name ?? labels.total;
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">{labels.title}</h3>
      <p className="text-muted-foreground text-sm">{labels.description}</p>
      <Table aria-label={labels.title} scrollRegionLabel={labels.title} className="min-w-[37rem]">
        <TableHeader>
          <TableHead isRowHeader>{t(($) => $.businessCenters.center)}</TableHead>
          {metrics.map((metric) => (
            <TableHead key={metric}>{labels[metric]}</TableHead>
          ))}
        </TableHeader>
        <TableBody items={total ? [...rows, { id: "total", amounts: total }] : rows}>
          {(row) => (
            <TableRow id={row.id}>
              <TableCell>{name(row.id)}</TableCell>
              {metrics.map((metric) => (
                <TableCell key={metric}>{formatAmounts(row.amounts[metric]) || "—"}</TableCell>
              ))}
            </TableRow>
          )}
        </TableBody>
      </Table>
      {total && (
        <div className="space-y-2 rounded-md border p-3">
          <h4 className="font-medium">{labels.reconciliation}</h4>
          {unmatched.length ? (
            <>
              <p>{labels.difference}</p>
              <ul className="list-disc ps-5">
                {unmatched.map(({ metric, amounts }) => (
                  <li key={metric}>
                    {labels[metric]} · {formatAmounts(amounts)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>{labels.match}</p>
          )}
        </div>
      )}
    </section>
  );
}
