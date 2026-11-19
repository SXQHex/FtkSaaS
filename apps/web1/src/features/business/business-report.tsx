import { useId, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, FieldLabel } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import type { CenterView } from "../../lib/api-contracts/generated";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { formatMinorAmount } from "../../lib/money";
import { reportInterval, reportRowKey } from "../reports/reports-read";

export function BusinessReport({
  scope,
  centers,
  aggregate,
}: {
  scope: ClientScope;
  centers: CenterView[];
  aggregate: boolean;
}) {
  const { t } = useTranslation();
  const periodId = useId();
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const centerIds = centers
    .filter((row) => row.state === "active" && (aggregate || row.id === scope.centerId))
    .map((row) => row.id);
  const timezone = centers.find((row) => row.id === scope.centerId)?.timezone ?? "UTC";
  const [anchor] = useState(() => new Date().toISOString());
  const report = useInfiniteQuery({
    queryKey: [
      "business-report",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      centerIds,
      days,
      anchor,
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const backend = await scopedBackend(scope);
      const interval = await reportInterval(timezone, days, "", "", anchor);
      const result = await backend.call("report_get_v1", {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: scope.orgId,
        ...(aggregate ? {} : { center_id: scope.centerId }),
        report: "cross_center_usage",
        filters: { interval, center_ids: centerIds },
        page: { limit: 25, ...(pageParam ? { cursor: pageParam } : {}) },
      });
      if (
        result.report_kind !== "cross_center_usage" ||
        result.filters.center_ids.length !== centerIds.length ||
        !result.filters.center_ids.every((id) => centerIds.includes(id)) ||
        result.rows.items.some((row) => row.center_id && !centerIds.includes(row.center_id)) ||
        (pageParam && result.rows.next_cursor === pageParam)
      )
        throw Error("BUSINESS_REPORT_SCOPE_INVALID");
      return result;
    },
    getNextPageParam: (last) => last.rows.next_cursor ?? undefined,
    enabled: centerIds.length > 0,
    retry: false,
    gcTime: 0,
  });
  const title = t(($) => $.businessCenters.tabs.reports);
  const rows = report.isError ? [] : (report.data?.pages.flatMap((page) => page.rows.items) ?? []);
  const rowsUnique = new Set(rows.map(reportRowKey)).size === rows.length;
  const name = (id?: string | null) =>
    centers.find((row) => row.id === id)?.name ?? t(($) => $.businessCenters.unknownCenter);
  const direction = (key: string) => {
    const [kind, peer] = key.split(":");
    if (kind === "outgoing_to") return t(($) => $.businessCenters.outgoing, { peer: name(peer) });
    if (kind === "incoming_from") return t(($) => $.businessCenters.incoming, { peer: name(peer) });
    return t(($) => $.businessCenters.total);
  };
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field className="w-fit">
          <FieldLabel htmlFor={periodId}>{t(($) => $.businessCenters.reportPeriod)}</FieldLabel>
          <NativeSelect
            id={periodId}
            value={days}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "7" || value === "30" || value === "90") setDays(value);
            }}
          >
            {(["7", "30", "90"] as const).map((value) => (
              <NativeSelectOption key={value} value={value}>
                {t(($) => $.businessCenters.reportDays, { count: Number(value) })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {!centerIds.length ? (
          <p>{t(($) => $.businessCenters.empty)}</p>
        ) : report.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : report.isError || !rowsUnique ? (
          <Alert variant="destructive">
            <AlertDescription className="space-y-2">
              <p>{t(($) => $.businessCenters.reportError)}</p>
              <Button variant="outline" onPress={() => void report.refetch()}>
                {t(($) => $.auth.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        ) : rows.length === 0 ? (
          <p>{t(($) => $.businessCenters.empty)}</p>
        ) : (
          <>
            <Table aria-label={title} scrollRegionLabel={title} className="min-w-[37rem]">
              <TableHeader>
                <TableHead isRowHeader>{t(($) => $.businessCenters.center)}</TableHead>
                <TableHead>{t(($) => $.businessCenters.direction)}</TableHead>
                <TableHead>{t(($) => $.businessCenters.quantity)}</TableHead>
                <TableHead>{t(($) => $.platform.billing.amount)}</TableHead>
              </TableHeader>
              <TableBody items={rows.map((row) => ({ ...row, id: reportRowKey(row) }))}>
                {(row) => (
                  <TableRow id={row.id}>
                    <TableCell>{name(row.center_id)}</TableCell>
                    <TableCell>{direction(row.group_key)}</TableCell>
                    <TableCell>{row.count ?? "—"}</TableCell>
                    <TableCell>
                      {row.amount_minor != null && row.currency
                        ? formatMinorAmount(row.amount_minor, row.currency)
                        : "—"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {report.hasNextPage && (
              <Button
                variant="outline"
                isDisabled={report.isFetching}
                onPress={() => void report.fetchNextPage()}
              >
                {t(($) => $.businessCenters.more)}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
