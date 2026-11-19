import { saveDownload } from "../../lib/save-download";
import { useCallback, useEffect, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import type {
  ReportFilters,
  ReportKind,
  ReportView,
  ImportDirectoryItem,
  JobState,
} from "../../lib/api-contracts/generated";
import { readWorkspace } from "../workspace/workspace";
import { readTracking } from "../audit/audit-read";
import { readFinanceDirectory, financeDirectoryTotal } from "../finance/finance-directory";
import {
  ReportsView,
  type ReportTab,
  type ReportRange,
  type ReportBreakdown,
  type ReportFileRow,
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
  const navigate = useNavigate({ from: "/o/$orgId/c/$centerId/reports" });
  const { orgId, centerId } = useParams({ from: "/o/$orgId/c/$centerId/reports" });
  const { action } = useSearch({ from: "/o/$orgId/c/$centerId/reports" });
  const shortcut = scope.orgId === orgId && scope.centerId === centerId ? action : undefined;
  const [selectedTab, setTab] = useState<ReportTab>("summary"),
    [range, setRange] = useState<ReportRange>("30"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [breakdown, setBreakdown] = useState<ReportBreakdown>("member");
  const [anchor, setAnchor] = useState(() => new Date().toISOString()),
    [locked, setLocked] = useState(false),
    [lost, setLost] = useState(false),
    [fileError, setFileError] = useState(false),
    [checkedExport, setCheckedExport] = useState<JobState>();
  const [exporting, setExporting] = useState<ReportFilters>();
  const [retryExport, setRetryExport] = useState<{ id: string; date: string }>();
  const [importing, setImporting] = useState<{ initial?: ImportDirectoryItem }>();
  const tab = shortcut === "import" ? "files" : selectedTab;
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
        setExporting(undefined);
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
  const jobStates = t(($) => $.reports.jobStates, { returnObjects: true });
  const jobState = (state: string) =>
    Object.hasOwn(jobStates, state) ? jobStates[state as JobState] : unknown;
  const amount = (view: ReportView | undefined, metric: string) =>
    view ? reportMoney(view.totals, metric) || t(($) => $.reports.empty) : unknown;
  const proportion = (view: ReportView | undefined, metric: string) =>
    view
      ? reportRatio(
          view.totals.find((row) => row.group_key === metric)?.ratio_bps,
          t(($) => $.reports.noDenominator),
        )
      : unknown;
  const conversion = data.crm?.rows.items.find(
    (row) => row.group_key === "crm_conversion" && row.center_id === scope.centerId,
  );
  const funnel = data.crm?.crm_funnel;
  const formatCount = (value: number) => value.toLocaleString("tr-TR");
  const currentFinance = active && !finance.isError ? finance.data : undefined;
  const currentImports = active && !imports.isError ? imports.data : undefined,
    currentExports = active && !exports.isError ? exports.data : undefined;
  const importReview =
    importing ?? (shortcut === "import" && currentImports?.limits ? {} : undefined);
  const exportFilters = exporting ?? (shortcut === "export" ? filters : undefined);
  const exportReview = retryExport
    ? { retry: retryExport }
    : exportFilters && {
        filters: exportFilters,
        period: `${exportFilters.interval.starts_at} – ${exportFilters.interval.ends_at} · ${timezone}`,
      };
  function closeShortcut() {
    if (shortcut) void navigate({ search: {}, replace: true });
  }
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
  async function file(id: string, action: ReportFileRow["action"]) {
    if (locked) return;
    setFileError(false);
    setCheckedExport(undefined);
    try {
      if (action === "download") {
        const row = currentExports?.items.find((row) => row.id === id);
        if (!row || row.state !== "succeeded") throw Error("REPORT_FILE_UNAVAILABLE");
        saveDownload(await downloadReport(scope, id, uuidv7()), `report-${id}.csv`);
      } else if (action === "rows") {
        const row = currentImports?.items.find((row) => row.job_id === id);
        if (!row) throw Error("IMPORT_JOB_UNKNOWN");
        setImporting({ initial: row });
      } else {
        const job = await readJob(scope, id);
        const refreshed = await exports.refetch({ throwOnError: true });
        setCheckedExport(job.state);
        if (action === "retry" && job.state === "failed") {
          const row = refreshed.data?.items.find((row) => row.id === id && row.state === "failed");
          if (row) setRetryExport({ id, date: date(row.created_at) });
        }
      }
    } catch (error) {
      if (!accessLost(error)) setFileError(true);
    }
  }
  return (
    <>
      <ReportsView
        tab={tab}
        onTab={(value) => {
          setTab(value);
          closeShortcut();
        }}
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
        onExport={() => {
          if (filters) setExporting(filters);
        }}
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
          funnel: funnel
            ? {
                converted: formatCount(funnel.converted_count),
                candidates: formatCount(funnel.cohort_count),
                rate: reportRatio(
                  funnel.cohort_count
                    ? Math.round((funnel.converted_count / funnel.cohort_count) * 10000)
                    : undefined,
                  t(($) => $.reports.noDenominator),
                ),
              }
            : conversion && {
                converted: conversion.count?.toLocaleString("tr-TR") ?? unknown,
                candidates: conversion.basis_count?.toLocaleString("tr-TR") ?? unknown,
                rate: reportRatio(
                  conversion.ratio_bps,
                  t(($) => $.reports.noDenominator),
                ),
              },
          funnelStages: funnel?.stages.map((row) => ({
            id: row.stage_key ? `stage:${row.stage_key}` : "no-stage",
            cells: [row.stage_key ?? t(($) => $.reports.crmNoStage), formatCount(row.count)],
          })),
          funnelSources: funnel?.sources.map((row) => ({
            id: row.source,
            cells: [
              t(($) => $.reports.crmFunnelSourceNames[row.source]),
              formatCount(row.count),
              formatCount(row.converted_count),
            ],
          })),
          funnelEmpty: data.crm ? t(($) => $.reports.empty) : unknown,
          exports: currentExports?.items.map((row) => ({
            id: row.id,
            name: t(($) => $.reports.exportTitle),
            detail:
              row.state === "retry_wait" && row.next_attempt_at
                ? `${date(row.created_at)} · ${t(($) => $.reports.exportNextAttempt, { date: date(row.next_attempt_at) })}`
                : date(row.created_at),
            state: jobState(row.state),
            action: row.state === "succeeded" ? "download" : "status",
            canRetry: row.state === "failed",
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
            state: jobState(row.state),
            action: "rows",
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
              <>
                <p role="status" className="text-sm text-muted-foreground">
                  {checkedExport &&
                    t(($) => $.reports.exportChecked, {
                      state: t(($) => $.reports.jobStates[checkedExport]),
                    })}
                </p>
                <Button
                  variant="outline"
                  isDisabled={locked || !active || !currentImports?.limits}
                  onPress={() => setImporting({})}
                >
                  {t(($) => $.reports.startImport)}
                </Button>
              </>
            )}
            <Button variant="outline" isDisabled={locked} onPress={() => void refresh()}>
              {t(($) => $.reports.readAgain)}
            </Button>
          </div>
        }
      />
      {importReview && active && (
        <ReportImportEditor
          key={importReview.initial?.job_id ?? "new"}
          scope={scope}
          limits={currentImports?.limits ?? null}
          initial={importReview.initial}
          onClose={() => {
            if (locked) return;
            if (shortcut === "import") setTab("files");
            setImporting(undefined);
            closeShortcut();
          }}
          onLockChange={lock}
          onAccessLost={accessLost}
          onSaved={refresh}
        />
      )}
      {exportReview && active && (
        <ReportExportEditor
          key={retryExport?.id ?? "export"}
          scope={scope}
          review={exportReview}
          onClose={() => {
            if (locked) return;
            setExporting(undefined);
            setRetryExport(undefined);
            closeShortcut();
          }}
          onLockChange={lock}
          onAccessLost={accessLost}
          onSaved={refresh}
        />
      )}
    </>
  );
}
