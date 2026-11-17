import { useCallback, useEffect, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import type {
  ReportFilters,
  ReportKind,
  ReportView,
  ImportDirectoryItem,
} from "../../lib/api-contracts/generated";
import { readWorkspace } from "../workspace/workspace";
import { readTracking } from "../audit/audit-read";
import { readFinanceDirectory, financeDirectoryTotal } from "../finance/finance-directory";
import {
  ReportsView,
  type ReportTab,
  type ReportRange,
  type ReportBreakdown,
} from "./reports-view";
import { reportInterval, readReport, readImportDirectory } from "./reports-read";
import {
  reportMoney,
  reportCount,
  reportRatio,
  salesPoints,
  sessionRows,
  instructorRows,
  collectionRows,
} from "./reports-presentation";
import { ReportImportEditor } from "./report-import-editor";
import { ReportExportEditor } from "./report-export-editor";
import { downloadReport, readJob } from "./reports-command";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
export function ReportsContent({
  scope,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  onLockChange: (value: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient();
  const [tab, setTab] = useState<ReportTab>("summary"),
    [range, setRange] = useState<ReportRange>("30"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [breakdown, setBreakdown] = useState<ReportBreakdown>("member");
  const [anchor, setAnchor] = useState(() => new Date().toISOString()),
    [locked, setLocked] = useState(false),
    [lost, setLost] = useState(false),
    [fileError, setFileError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState<{ initial?: ImportDirectoryItem }>();
  const [pages, setPages] = useState<
    Record<string, { cursors: (string | undefined)[]; index: number }>
  >({});
  const workspace = useQuery({
    queryKey: ["workspace", scope.accountId, scope.orgId],
    queryFn: () => readWorkspace(scope.accountId, scope.orgId),
    enabled: false,
    retry: false,
  });
  const center =
    (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
      ? workspace.data.centers.find((row) => row.id === scope.centerId && row.accessible)
      : undefined;
  const timezone = center?.timezone;
  const active = !!timezone && !lost;
  const interval = useQuery({
    queryKey: ["report-interval", timezone, range, from, to, anchor],
    queryFn: () => reportInterval(timezone!, range, from, to, anchor),
    enabled: active,
    retry: false,
    staleTime: Infinity,
  });
  const filters: ReportFilters | undefined =
    interval.data && !interval.isError
      ? { interval: interval.data, center_ids: [scope.centerId] }
      : undefined;
  const cursor = (name: string) => pages[name]?.cursors[pages[name]!.index];
  const definitions: {
    name: "weeks" | "products" | "sessions" | "collections" | "balances" | "crm";
    kind: ReportKind;
    breakdown?: "week" | "product" | "person";
    enabled: boolean;
  }[] = [
    { name: "weeks", kind: "sales", breakdown: "week", enabled: tab === "summary" },
    { name: "products", kind: "sales", breakdown: "product", enabled: tab === "summary" },
    { name: "sessions", kind: "session_metrics", enabled: tab === "summary" },
    {
      name: "collections",
      kind: "collection_breakdown",
      breakdown: breakdown === "package" ? "product" : "person",
      enabled: tab === "collections" && breakdown !== "instructor",
    },
    {
      name: "balances",
      kind: "instructor_balances",
      enabled: tab === "instructors" || (tab === "collections" && breakdown === "instructor"),
    },
    { name: "crm", kind: "crm_conversion", enabled: tab === "instructors" },
  ];
  const reports = useQueries({
    queries: definitions.map((item) => ({
      queryKey: [
        "report-view",
        scope,
        item.name,
        item.kind,
        item.breakdown,
        filters,
        cursor(item.name),
      ],
      queryFn: () =>
        readReport(
          scope,
          item.kind,
          { ...filters!, ...(item.breakdown ? { breakdown: item.breakdown } : {}) },
          cursor(item.name),
        ),
      enabled: active && !!filters && item.enabled,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  const data = Object.fromEntries(
    definitions.map((item, index) => [
      item.name,
      active && !reports[index]!.isError ? reports[index]!.data : undefined,
    ]),
  ) as Partial<Record<(typeof definitions)[number]["name"], ReportView>>;
  const finance = useQuery({
    queryKey: ["report-finance-summary", scope, filters],
    queryFn: () => readFinanceDirectory(scope, "movements", filters!.interval),
    enabled: active && !!filters && tab === "collections",
    retry: false,
    refetchOnWindowFocus: false,
  });
  const imports = useQuery({
    queryKey: ["report-import-directory", scope, cursor("imports")],
    queryFn: () => readImportDirectory(scope, cursor("imports")),
    enabled: active && tab === "files",
    retry: false,
    refetchOnWindowFocus: false,
  });
  const exports = useQuery({
    queryKey: ["report-export-directory", scope, cursor("exports")],
    queryFn: () =>
      readTracking(scope, {
        period: "all",
        anchor,
        timezone: timezone!,
        kind: "job",
        query: "report_build_v1",
        cursor: cursor("exports"),
      }),
    enabled: active && tab === "files",
    retry: false,
    refetchOnWindowFocus: false,
  });
  const lock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  useEffect(() => () => onLockChange(false), [onLockChange]);
  const accessLost = useCallback(
    (error: unknown) => {
      if (
        (error instanceof BackendError &&
          [
            "AUTH_REQUIRED",
            "SESSION_REVOKED",
            "FORBIDDEN",
            "NOT_FOUND",
            "PLAN_FEATURE_UNAVAILABLE",
          ].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        setLost(true);
        setExporting(false);
        setImporting(undefined);
        setLocked(false);
        onLockChange(false);
        void router.invalidate();
        return true;
      }
      return false;
    },
    [router, onLockChange],
  );
  const unknown = t(($) => $.reports.unknown);
  const amount = (view: ReportView | undefined, metric: string) =>
    view ? reportMoney(view.totals, metric) || t(($) => $.reports.empty) : unknown;
  const proportion = (view: ReportView | undefined, metric: string) =>
    view
      ? reportRatio(
          view.totals.find((row) => row.group_key === metric)?.ratio_bps,
          t(($) => $.reports.noDenominator),
        )
      : unknown;
  const currentFinance = active && !finance.isError ? finance.data : undefined;
  const currentImports = active && !imports.isError ? imports.data : undefined,
    currentExports = active && !exports.isError ? exports.data : undefined;
  const date = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      timeZone: timezone!,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  const moneyHint = t(($) => $.reports.recordedSales);
  function pagination(name: string, next: string | null | undefined, busy: boolean) {
    const position = pages[name]?.index ?? 0;
    if (!next && position === 0) return null;
    const label = t(
      ($) =>
        $.reports.sourceNames[
          name as
            | "weeks"
            | "products"
            | "sessions"
            | "collections"
            | "balances"
            | "crm"
            | "exports"
            | "imports"
        ],
    );
    return (
      <div key={name} className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          isDisabled={locked || busy || position === 0}
          onPress={() =>
            setPages((values) => ({
              ...values,
              [name]: { cursors: values[name]!.cursors, index: position - 1 },
            }))
          }
        >
          {t(($) => $.reports.previousFor, { name: label })}
        </Button>
        <Button
          variant="outline"
          size="sm"
          isDisabled={locked || busy || !next}
          onPress={() => {
            if (next)
              setPages((values) => ({
                ...values,
                [name]: {
                  cursors: [...(values[name]?.cursors ?? [undefined]).slice(0, position + 1), next],
                  index: position + 1,
                },
              }));
          }}
        >
          {t(($) => $.reports.moreFor, { name: label })}
        </Button>
      </div>
    );
  }
  const controls = (names: string[]) =>
    definitions.flatMap((item, index) =>
      names.includes(item.name)
        ? [pagination(item.name, data[item.name]?.rows.next_cursor, reports[index]!.isFetching)]
        : [],
    );
  async function refresh() {
    setPages({});
    setAnchor(new Date().toISOString());
    setFileError(false);
    await Promise.all([
      queries.invalidateQueries({ queryKey: ["report-view", scope] }),
      queries.invalidateQueries({ queryKey: ["report-finance-summary", scope] }),
      queries.invalidateQueries({ queryKey: ["report-export-directory", scope] }),
      queries.invalidateQueries({ queryKey: ["report-import-directory", scope] }),
    ]);
  }
  async function file(
    kind: "export" | "import",
    id: string,
    action: "download" | "retry" | "rows",
  ) {
    if (locked) return;
    setFileError(false);
    try {
      if (kind === "export" && action === "download") {
        const row = currentExports?.items.find((row) => row.id === id);
        if (!row || row.state !== "succeeded") throw Error("REPORT_FILE_UNAVAILABLE");
        const blob = await downloadReport(scope, id, uuidv7());
        const url = URL.createObjectURL(blob),
          link = document.createElement("a");
        link.href = url;
        link.download = `report-${id}.csv`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (kind === "import" && action === "rows") {
        const row = currentImports?.items.find((row) => row.job_id === id);
        if (!row) throw Error("IMPORT_JOB_UNKNOWN");
        setImporting({ initial: row });
      } else {
        await readJob(scope, id);
        await refresh();
      }
    } catch (error) {
      if (!accessLost(error)) setFileError(true);
    }
  }
  return (
    <>
      <ReportsView
        tab={tab}
        onTab={setTab}
        range={range}
        onRange={(value) => {
          setRange(value);
          setPages({});
        }}
        from={from}
        to={to}
        onDates={(a, b) => {
          setFrom(a);
          setTo(b);
          setPages({});
        }}
        breakdown={breakdown}
        onBreakdown={(value) => {
          setBreakdown(value);
          setPages({});
        }}
        onExport={() => setExporting(true)}
        onPeople={() =>
          void router.navigate({
            to: "/o/$orgId/c/$centerId/people",
            params: { orgId: scope.orgId, centerId: scope.centerId },
          })
        }
        onFile={(...args) => void file(...args)}
        locked={locked || !active}
        data={{
          summary: [
            { value: amount(data.weeks, "gross_sales:"), hint: moneyHint },
            { value: data.weeks ? reportCount(data.weeks.totals, "gross_sales:") : unknown },
            { value: proportion(data.sessions, "occupancy") },
            { value: proportion(data.sessions, "closed_attendance") },
          ],
          collections: [
            {
              value: currentFinance
                ? (financeDirectoryTotal(currentFinance.totals, "collections_minor") ??
                  t(($) => $.reports.empty))
                : unknown,
            },
            {
              value: currentFinance
                ? (financeDirectoryTotal(currentFinance.totals, "debt_minor") ??
                  t(($) => $.reports.empty))
                : unknown,
            },
            {
              value: currentFinance
                ? (financeDirectoryTotal(currentFinance.totals, "credit_minor") ??
                  t(($) => $.reports.empty))
                : unknown,
            },
            { value: unknown, hint: t(($) => $.reports.rateUnavailable) },
          ],
          instructors: [
            { value: amount(data.balances, "earning_accrual") },
            { value: amount(data.balances, "instructor_paid") },
            { value: amount(data.balances, "instructor_remaining") },
            { value: unknown, hint: t(($) => $.reports.rateUnavailable) },
          ],
          weeks: data.weeks ? salesPoints(data.weeks, "week", t) : undefined,
          packages: data.products ? salesPoints(data.products, "product", t) : undefined,
          packageSummary: t(($) => $.reports.relativeBars),
          lessons: data.sessions ? sessionRows(data.sessions, t) : undefined,
          breakdowns: {
            member:
              data.collections && breakdown === "member"
                ? {
                    description: t(($) => $.reports.nativeBalance),
                    rows: collectionRows(data.collections, "person", t),
                  }
                : undefined,
            package:
              data.collections && breakdown === "package"
                ? {
                    description: t(($) => $.reports.nativeBalance),
                    rows: collectionRows(data.collections, "product", t),
                  }
                : undefined,
            instructor: data.balances
              ? {
                  description: t(($) => $.reports.nativeMeasures),
                  rows: instructorRows(data.balances, t),
                }
              : undefined,
          },
          earnings: data.balances ? instructorRows(data.balances, t) : undefined,
          funnel: data.crm
            ? data.crm.totals.map((row, index) => ({
                id: String(index),
                label: t(($) => $.reports.crmConverted),
                value: row.count,
                display: `${row.count.toLocaleString("tr-TR")} / ${row.basis_count?.toLocaleString("tr-TR") ?? unknown}`,
              }))
            : undefined,
          funnelSummary: t(($) => $.reports.crmNative),
          exports: currentExports?.items.map((row) => ({
            id: row.id,
            name: t(($) => $.reports.exportTitle),
            detail: date(row.created_at),
            state: row.state,
            canDownload: row.state === "succeeded",
            canRetry: row.state !== "succeeded",
            progress:
              row.progress_count !== null && row.total_count
                ? (row.progress_count / row.total_count) * 100
                : undefined,
          })),
          imports: currentImports?.items.map((row) => ({
            id: row.job_id,
            name:
              row.kind === "students"
                ? t(($) => $.reports.studentImport)
                : t(($) => $.reports.crmImport),
            detail: `${date(row.created_at)} · ${row.phase}`,
            state: row.state,
            canReadRows: true,
            progress: row.total_count ? (row.progress_count / row.total_count) * 100 : undefined,
          })),
        }}
        after={{
          summary: controls(["weeks", "products", "sessions"]),
          collections: controls([breakdown === "instructor" ? "balances" : "collections"]),
          instructors: controls(["balances", "crm"]),
          files: (
            <>
              {pagination("exports", currentExports?.next_cursor, exports.isFetching)}
              {pagination("imports", currentImports?.next_cursor, imports.isFetching)}
            </>
          ),
        }}
        notice={
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                {tab === "files"
                  ? t(($) => $.reports.nativeFiles)
                  : tab === "collections"
                    ? t(($) => $.reports.nativeBalance)
                    : t(($) => $.reports.nativeMeasures)}
              </AlertDescription>
            </Alert>
            {(interval.isError ||
              definitions.some((item, index) => item.enabled && reports[index]!.isError) ||
              (tab === "collections" && finance.isError) ||
              (tab === "files" && (imports.isError || exports.isError)) ||
              fileError ||
              !active) && (
              <Alert variant="destructive">
                <AlertDescription role="alert">
                  {interval.isError
                    ? t(($) => $.reports.intervalInvalid)
                    : t(($) => $.reports.readFailed)}
                </AlertDescription>
              </Alert>
            )}
            {tab === "files" && (
              <Button
                variant="outline"
                isDisabled={locked || !active || !currentImports?.limits}
                onPress={() => setImporting({})}
              >
                {t(($) => $.reports.startImport)}
              </Button>
            )}
            <Button variant="outline" isDisabled={locked} onPress={() => void refresh()}>
              {t(($) => $.reports.readAgain)}
            </Button>
          </div>
        }
      />
      {importing && active && (
        <ReportImportEditor
          key={importing.initial?.job_id ?? "new"}
          scope={scope}
          limits={currentImports?.limits ?? null}
          initial={importing.initial}
          onClose={() => {
            if (!locked) setImporting(undefined);
          }}
          onLockChange={lock}
          onAccessLost={accessLost}
          onSaved={refresh}
        />
      )}
      {exporting && active && filters && (
        <ReportExportEditor
          scope={scope}
          filters={filters}
          period={`${filters.interval.starts_at} – ${filters.interval.ends_at} · ${timezone}`}
          onClose={() => {
            if (!locked) setExporting(false);
          }}
          onLockChange={lock}
          onAccessLost={accessLost}
          onSaved={refresh}
        />
      )}
    </>
  );
}
