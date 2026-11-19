import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import type { CenterView, Interval, ReportTotal } from "../../lib/api-contracts/generated";
import { formatMinorAmount } from "../../lib/money";
import type { ClientScope } from "../../lib/scoped-backend";
import { readScopedReport, reportInterval } from "../reports/reports-read";

const metrics = ["sales", "collections", "debt"] as const;
type Amounts = Map<string, bigint>;
type Finance = Record<(typeof metrics)[number], Amounts>;

function groupAmounts(rows: ReportTotal[]) {
  const result: Amounts = new Map();
  for (const row of rows) {
    if (!row.currency || row.amount_minor == null) throw Error("BUSINESS_FINANCE_TOTAL_INVALID");
    result.set(row.currency, (result.get(row.currency) ?? 0n) + BigInt(row.amount_minor));
  }
  return result;
}

async function readFinance(
  scope: ClientScope,
  centerIds: string[],
  interval: Interval,
  aggregate: boolean,
): Promise<Finance> {
  const filters = { interval, center_ids: centerIds };
  const [sales, receivables] = await Promise.all([
    readScopedReport(scope, "sales", filters, { aggregate, limit: 1 }),
    readScopedReport(scope, "collections_debts", filters, { aggregate, limit: 1 }),
  ]);
  return {
    sales: groupAmounts(sales.totals.filter((row) => row.group_key?.startsWith("gross_sales:"))),
    collections: groupAmounts(receivables.totals.filter((row) => row.group_key === "collections")),
    debt: groupAmounts(receivables.totals.filter((row) => row.group_key === "outstanding_debt")),
  };
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
    queryFn: async ({ signal }) => {
      const interval = await reportInterval(timezone, range, "", "", anchor);
      const rows = [];
      for (const centerId of centerIds) {
        signal.throwIfAborted();
        rows.push({
          id: centerId,
          amounts: await readFinance({ ...scope, centerId }, [centerId], interval, false),
        });
      }
      signal.throwIfAborted();
      const total = aggregate ? await readFinance(scope, centerIds, interval, true) : undefined;
      return { rows, total };
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
