import { saveDownload } from "../../lib/save-download";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import type { ClientScope } from "../../lib/scoped-backend";
import type {
  ImportDirectoryItem,
  ImportMapping,
  ImportTarget,
  ImportRowState,
} from "@ftksaas/api-contracts";
import { formatMinorAmount } from "../../lib/money";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import {
  writeComplete,
  readComplete,
  documentReceipt,
  type CompleteIntent,
} from "../documents/document-publication";
import { ReportImportSheet, type ImportRowFilter } from "./report-sheets";
import { readImportRows, readImportPreview } from "./import-read";
import {
  importUploadIntent,
  prepareImport,
  transferImport,
  reportsCommon,
  writeReportJob,
  reportJobReceipt,
  readReportJob,
  readJob,
  downloadSkippedImportRows,
  type ImportUploadIntent,
  type ReportJobIntent,
} from "./reports-command";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Field, FieldLabel, FieldDescription } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Button } from "@ftksaas/ui/components/button";
const studentTargets: ImportTarget[] = [
  "source_key",
  "display_name",
  "email",
  "phone",
  "person_ref",
  "opening_credits",
  "opening_debt_minor",
  "currency",
  "product_version_ref",
  "start_date",
  "end_date",
  "opening_credit_value_minor",
];
const crmTargets: ImportTarget[] = [
  "source_key",
  "display_name",
  "phone",
  "email",
  "interest",
  "message",
  "partner_name",
  "mode",
  "consents",
  "source_url",
];
export function ReportImportEditor({
  scope,
  limits,
  initial,
  onClose,
  onLockChange,
  onAccessLost,
  onSaved,
}: {
  scope: ClientScope;
  limits: { max_bytes: number; max_rows: number } | null;
  initial?: ImportDirectoryItem;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const [file, setFile] = useState<File>(),
    [kind, setKind] = useState<"students" | "crm_applications">(initial?.kind ?? "students"),
    [namespace, setNamespace] = useState(""),
    [delimiter, setDelimiter] = useState<"," | ";">(",");
  const [jobId, setJob] = useState(initial?.job_id),
    [phase, setPhase] = useState<"preview" | "apply">(initial?.phase ?? "preview"),
    [filter, setFilter] = useState<ImportRowFilter>("all");
  const [downloadingSkipped, setDownloadingSkipped] = useState(false);
  const [skippedDownloadFailed, setSkippedDownloadFailed] = useState(false);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0),
    [selected, setSelected] = useState<Set<number>>(new Set());
  const [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [uploadUnknown, setUploadUnknown] = useState(false),
    [uploadStarted, setUploadStarted] = useState(false),
    [now, setNow] = useState(() => Date.now()),
    [error, setError] = useState(false),
    [rowsOnly, setRowsOnly] = useState(false),
    [unavailable, setUnavailable] = useState(false);
  const upload = useRef<ImportUploadIntent | undefined>(undefined),
    complete = useRef<CompleteIntent | undefined>(undefined),
    ready = useRef<string | undefined>(undefined),
    executing = useRef(false),
    mounted = useRef(true),
    previewIntent = useRef<ReportJobIntent | undefined>(undefined),
    applyIntent = useRef<ReportJobIntent | undefined>(undefined);
  const targets = kind === "students" ? studentTargets : crmTargets;
  const [sources, setSources] = useState<Partial<Record<ImportTarget, string>>>({
    source_key: "source_key",
    display_name: "display_name",
    phone: "phone",
    email: "email",
  });
  const mapping: ImportMapping = {
    kind,
    delimiter,
    columns: targets.flatMap((target) =>
      sources[target]?.trim() ? [{ source_column: sources[target]!.trim(), target }] : [],
    ),
  };
  const lost = (cause: unknown) => {
    if (onAccessLost(cause)) {
      setUnavailable(true);
      return true;
    }
    return false;
  };
  const completion = useMemberCommand({
    write: writeComplete,
    readReceipt: documentReceipt,
    readResult: readComplete,
    onAccessLost: lost,
    onRefresh: async (fileId) => {
      ready.current = fileId;
      setUploadUnknown(false);
    },
  });
  const command = useMemberCommand({
    write: writeReportJob,
    readReceipt: reportJobReceipt,
    readResult: readReportJob,
    onAccessLost: lost,
    onRefresh: async (job) => {
      queries.setQueryData(["report-import-job", scope, job.id], job);
      setJob(job.id);
      setRowsOnly(false);
      setCursors([undefined]);
      setIndex(0);
      setReviewed(false);
      await onSaved();
    },
  });
  const locked = busy || uploadUnknown || completion.locked || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useBlocker({
    shouldBlockFn: () => uploadUnknown || executing.current,
    enableBeforeUnload: uploadUnknown || busy,
    disabled: !uploadUnknown && !busy,
  });
  const job = useQuery({
    queryKey: ["report-import-job", scope, jobId],
    queryFn: () => readJob(scope, jobId!),
    enabled: !!jobId && !unavailable,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const currentJob = !job.isError && !unavailable ? job.data : undefined;
  const previewId =
    phase === "preview" && currentJob?.state === "succeeded"
      ? currentJob.result_reference?.type === "previews"
        ? currentJob.result_reference.id
        : initial?.preview_id
      : undefined;
  const preview = useQuery({
    queryKey: ["report-import-preview", scope, previewId],
    queryFn: () => readImportPreview(scope, previewId!),
    enabled: !!previewId && !unavailable,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const currentPreview = !preview.isError && !unavailable ? preview.data : undefined;
  const state = filter === "all" ? undefined : (filter as ImportRowState);
  const applyFinished =
    phase === "apply" && (currentJob?.state === "succeeded" || currentJob?.state === "failed");
  const rows = useQuery({
    queryKey: ["report-import-rows", scope, jobId, state, cursors[index], applyFinished],
    queryFn: (context) =>
      readImportRows(scope, jobId!, state, cursors[index], applyFinished, context),
    enabled: !!jobId && !unavailable,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const currentRows = !rows.isError && !unavailable ? rows.data : undefined;
  const knownValid = useRef(new Set<number>());
  useEffect(() => {
    if (currentRows)
      for (const row of currentRows.items)
        if (row.state === "valid") knownValid.current.add(row.row_number);
        else knownValid.current.delete(row.row_number);
  }, [currentRows]);
  const summary = currentPreview?.import_summary;
  const applySummary = applyFinished ? currentRows?.apply_summary : undefined;
  useEffect(() => {
    if (!currentPreview) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Math.min(2147483647, Date.parse(currentPreview.expires_at) - Date.now())),
    );
    return () => window.clearTimeout(timer);
  }, [currentPreview]);
  const validPreview =
    !job.isError &&
    !rows.isError &&
    currentJob?.state === "succeeded" &&
    !!currentPreview &&
    (!currentPreview.import_summary?.import_kind ||
      currentPreview.import_summary.import_kind === kind) &&
    Date.parse(currentPreview.expires_at) > now &&
    currentPreview.blockers.length === 0;
  const step =
    !jobId && phase === "preview"
      ? "file"
      : rowsOnly
        ? "rows"
        : phase === "preview" && currentPreview
          ? "preview"
          : "result";
  function changeFile(value: File | undefined) {
    if (locked) return;
    setFile(value);
    setUploadStarted(false);
    upload.current = undefined;
    complete.current = undefined;
    ready.current = undefined;
    previewIntent.current = undefined;
    applyIntent.current = undefined;
    completion.reset();
    command.reset();
    setError(false);
  }
  async function prepare() {
    if (executing.current || completion.locked || command.locked || unavailable) return;
    if (
      !file ||
      (!limits && !upload.current) ||
      !namespace.trim() ||
      namespace.trim().length > 100 ||
      !mapping.columns.some((row) => row.target === "source_key") ||
      !mapping.columns.some((row) => row.target === "display_name") ||
      (kind === "crm_applications" && !mapping.columns.some((row) => row.target === "phone")) ||
      new Set(mapping.columns.map((row) => row.source_column)).size !== mapping.columns.length
    ) {
      setError(true);
      return;
    }
    executing.current = true;
    setBusy(true);
    setError(false);
    try {
      if (!ready.current) {
        if (!upload.current) {
          upload.current = await importUploadIntent(scope, file, limits!.max_bytes);
          setUploadStarted(true);
        }
        setUploadUnknown(true);
        const descriptor = await prepareImport(upload.current);
        if (complete.current && complete.current.request.file_id !== descriptor.file_id)
          throw Error("IMPORT_FILE_CHANGED");
        await transferImport(upload.current, descriptor);
        if (!mounted.current) return;
        setUploadUnknown(false);
        complete.current ??= {
          scope: { ...scope },
          request: {
            ...reportsCommon(scope),
            operation_key: uuidv7(),
            file_id: descriptor.file_id,
            checksum: upload.current.checksum,
          },
        };
        if (
          completion.state === "ready" ||
          completion.state === "stale" ||
          completion.state === "rejected"
        )
          await completion.start(complete.current);
        if (!ready.current) return;
      }
      previewIntent.current ??= {
        scope: { ...scope },
        operation: "import_preview_v1",
        request: {
          ...reportsCommon(scope),
          operation_key: uuidv7(),
          file_id: ready.current,
          source_namespace: namespace.trim(),
          mapping: structuredClone(mapping),
        },
      };
      setPhase("preview");
      await command.start(previewIntent.current);
    } catch (cause) {
      if (mounted.current && !lost(cause)) setError(true);
    } finally {
      executing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function apply() {
    if (
      locked ||
      !validPreview ||
      !reviewed ||
      !currentPreview ||
      Date.parse(currentPreview.expires_at) <= Date.now() ||
      unavailable ||
      (kind === "crm_applications" && selected.size === 0)
    )
      return;
    const chosen = [...selected].sort((a, b) => a - b);
    if (chosen.some((number) => !knownValid.current.has(number))) {
      setError(true);
      return;
    }
    applyIntent.current ??= {
      scope: { ...scope },
      operation: "import_apply_v1",
      request: {
        ...reportsCommon(scope),
        operation_key: uuidv7(),
        preview: { id: currentPreview.id, token: currentPreview.token },
        ...(kind === "crm_applications"
          ? { selected_row_numbers: chosen as [number, ...number[]] }
          : {}),
      },
    };
    setJob(undefined);
    setPhase("apply");
    command.reset();
    await command.start(applyIntent.current);
  }
  async function refresh() {
    setError(false);
    const reads = await Promise.all([
      job.refetch(),
      rows.refetch(),
      ...(previewId ? [preview.refetch()] : []),
    ]);
    if (reads.some((row) => row.isError)) setError(true);
    await onSaved();
  }
  const count = (value: number) => value.toLocaleString("tr-TR");
  async function downloadSkipped() {
    if (!jobId || !applySummary || downloadingSkipped || locked) return;
    setSkippedDownloadFailed(false);
    setDownloadingSkipped(true);
    try {
      const blob = await downloadSkippedImportRows(scope, jobId);
      if (mounted.current) saveDownload(blob, `import-skipped-${jobId}.csv`);
    } catch (cause) {
      if (mounted.current && !lost(cause)) setSkippedDownloadFailed(true);
    } finally {
      if (mounted.current) setDownloadingSkipped(false);
    }
  }
  function template() {
    const blob = new Blob(
      [
        mapping.columns
          .map((row) => `"${row.source_column.replaceAll('"', '""')}"`)
          .join(delimiter) + "\r\n",
      ],
      { type: "text/csv;charset=utf-8" },
    );
    saveDownload(blob, `${kind}-template.csv`);
  }
  return (
    <ReportImportSheet
      step={step}
      fileName={file?.name ?? (initial ? t(($) => $.reports.existingImport) : "")}
      limits={
        limits
          ? t(($) => $.reports.importLimits, {
              bytes: count(limits.max_bytes),
              rows: count(limits.max_rows),
            })
          : t(($) => $.reports.importUnconfigured)
      }
      rows={
        currentRows?.items.map((row) => ({
          id: String(row.row_number),
          number: count(row.row_number),
          name:
            row.student_preview?.display_name ??
            row.application?.intake.display_name ??
            t(($) => $.reports.unknown),
          contact:
            row.student_preview?.contacts.map((item) => item.value).join(" · ") ??
            row.application?.intake.phone ??
            "",
          state: row.state,
          reason: [
            row.error_code,
            ...(row.field_errors ?? []),
            ...(row.student_preview?.warnings ?? []),
          ]
            .filter(Boolean)
            .join(" · "),
          selectable: step === "preview" && kind === "crm_applications" && row.state === "valid",
          selected: selected.has(row.row_number),
        })) ?? []
      }
      summary={
        summary
          ? {
              eligible: count(summary.valid_rows),
              skipped: count(summary.invalid_rows),
              warnings: count(summary.replayed_rows),
            }
          : undefined
      }
      filter={filter}
      onFilter={(value) => {
        setFilter(value);
        setCursors([undefined]);
        setIndex(0);
      }}
      availableFilters={["all", "pending", "valid", "invalid", "applied", "failed"]}
      onFile={changeFile}
      onTemplate={template}
      onPreview={() => void prepare()}
      onApply={() => void apply()}
      onBack={() => {
        if (!locked) {
          setRowsOnly(false);
          setReviewed(false);
        }
      }}
      onClose={onClose}
      onReadRows={() => setRowsOnly(true)}
      onSelectRow={(id, value) => {
        const number = Number(id);
        if (!knownValid.current.has(number)) return;
        setSelected((previous) => {
          const next = new Set(previous);
          if (value) next.add(number);
          else next.delete(number);
          return next;
        });
        setReviewed(false);
      }}
      reviewed={reviewed}
      onReviewed={setReviewed}
      progress={
        currentJob?.total_count
          ? (currentJob.progress_count / currentJob.total_count) * 100
          : undefined
      }
      locked={locked}
      canPreview={!!file && !!limits && !unavailable}
      canApply={
        validPreview &&
        reviewed &&
        !unavailable &&
        (kind !== "crm_applications" || selected.size > 0) &&
        phase === "preview"
      }
      canTemplate={mapping.columns.length > 0}
      canReadRows={!!jobId}
      error={
        error || job.isError || rows.isError || preview.isError
          ? t(($) => $.reports.importFailed)
          : undefined
      }
      notice={
        <div className="space-y-3">
          {step === "file" && !uploadStarted && (
            <>
              <Field>
                <FieldLabel htmlFor="import-kind">{t(($) => $.reports.importKind)}</FieldLabel>
                <NativeSelect
                  id="import-kind"
                  value={kind}
                  onChange={(event) => {
                    if (
                      event.target.value === "students" ||
                      event.target.value === "crm_applications"
                    ) {
                      setKind(event.target.value);
                      setReviewed(false);
                    }
                  }}
                >
                  <NativeSelectOption value="students">
                    {t(($) => $.reports.studentImport)}
                  </NativeSelectOption>
                  <NativeSelectOption value="crm_applications">
                    {t(($) => $.reports.crmImport)}
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="import-namespace">{t(($) => $.reports.namespace)}</FieldLabel>
                <Input
                  id="import-namespace"
                  value={namespace}
                  required
                  maxLength={100}
                  onChange={(event) => setNamespace(event.target.value)}
                />
                <FieldDescription>{t(($) => $.reports.namespaceHint)}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="import-delimiter">{t(($) => $.reports.delimiter)}</FieldLabel>
                <NativeSelect
                  id="import-delimiter"
                  value={delimiter}
                  onChange={(event) => {
                    if (event.target.value === "," || event.target.value === ";")
                      setDelimiter(event.target.value);
                  }}
                >
                  <NativeSelectOption value=",">,</NativeSelectOption>
                  <NativeSelectOption value=";">;</NativeSelectOption>
                </NativeSelect>
              </Field>
              <details>
                <summary>{t(($) => $.reports.mapping)}</summary>
                <div className="mt-3 space-y-3">
                  {targets.map((target) => (
                    <Field key={target}>
                      <FieldLabel htmlFor={`import-column-${target}`}>
                        {t(($) => $.reports.importFields[target])}
                      </FieldLabel>
                      <Input
                        id={`import-column-${target}`}
                        value={sources[target] ?? ""}
                        maxLength={255}
                        onChange={(event) =>
                          setSources((values) => ({ ...values, [target]: event.target.value }))
                        }
                      />
                    </Field>
                  ))}
                </div>
              </details>
            </>
          )}
          <Alert>
            <AlertDescription>{t(($) => $.reports.importNative)}</AlertDescription>
          </Alert>
          {currentJob && (
            <p role="status">
              {t(($) => $.reports.jobState, {
                state: currentJob.state,
                processed: count(currentJob.progress_count),
                total:
                  currentJob.total_count === null
                    ? t(($) => $.reports.unknown)
                    : count(currentJob.total_count),
              })}
              {currentJob.safe_error_code ? ` · ${currentJob.safe_error_code}` : ""}
            </p>
          )}
          {applySummary && (
            <div className="space-y-2">
              <p role="status">
                {t(($) => $.reports.importApplySummary, {
                  total: count(applySummary.total_rows),
                  applied: count(applySummary.applied_rows),
                  skipped: count(applySummary.skipped_rows),
                  failed: count(applySummary.failed_rows),
                  replayed: count(applySummary.replayed_rows),
                })}
              </p>
              {applySummary.total_rows > applySummary.applied_rows && (
                <Button
                  variant="outline"
                  isDisabled={locked || downloadingSkipped}
                  onPress={() => void downloadSkipped()}
                >
                  {t(($) => $.reports.importSkippedDownload)}
                </Button>
              )}
              {skippedDownloadFailed && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t(($) => $.reports.importSkippedDownloadFailed)}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          {summary && (
            <>
              <p>
                {t(($) => $.reports.importImpact, {
                  people: count(summary.new_people),
                  applications: count(summary.new_applications ?? 0),
                  credits: count(summary.opening_credits),
                  negative: count(summary.existing_negative_credits),
                })}
              </p>
              <p>
                {t(($) => $.reports.openingDebts)}:{" "}
                {summary.opening_debt_totals
                  .map((row) => formatMinorAmount(row.amount_minor, row.currency))
                  .join(" · ") || t(($) => $.reports.empty)}
              </p>
              <p>
                {t(($) => $.reports.originalBasis)}:{" "}
                {summary.original_credit_basis_totals
                  .map((row) => formatMinorAmount(row.amount_minor, row.currency))
                  .join(" · ") || t(($) => $.reports.empty)}
              </p>
              <p>{t(($) => $.reports.selectedRows, { count: selected.size })}</p>
              <p>{t(($) => $.reports.previewExpires, { time: currentPreview!.expires_at })}</p>
              {!validPreview && (
                <Alert variant="destructive">
                  <AlertDescription>{t(($) => $.reports.previewUnavailable)}</AlertDescription>
                </Alert>
              )}
            </>
          )}
          {jobId && (
            <Button
              variant="outline"
              isDisabled={locked || job.isFetching || rows.isFetching}
              onPress={() => void refresh()}
            >
              {t(($) => $.reports.refreshJob)}
            </Button>
          )}
          {currentRows && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                isDisabled={locked || index === 0 || rows.isFetching}
                onPress={() => setIndex((value) => value - 1)}
              >
                {t(($) => $.earnings.previousPage)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                isDisabled={locked || !currentRows.next_cursor || rows.isFetching}
                onPress={() => {
                  if (currentRows.next_cursor) {
                    setCursors((values) => [
                      ...values.slice(0, index + 1),
                      currentRows.next_cursor!,
                    ]);
                    setIndex((value) => value + 1);
                  }
                }}
              >
                {t(($) => $.earnings.nextPage)}
              </Button>
            </div>
          )}
          {uploadUnknown && (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.reports.uploadUnknown)}
                <Button variant="outline" isDisabled={busy} onPress={() => void prepare()}>
                  {t(($) => $.studio.retrySameRequest)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <EventCommandNotice
            command={completion}
            onReload={() => {
              if (!locked) completion.reset();
            }}
          />
          <EventCommandNotice
            command={command}
            onReload={() => {
              if (command.state === "stale" || command.state === "rejected") {
                command.reset();
                previewIntent.current = undefined;
                applyIntent.current = undefined;
                setJob(undefined);
                setPhase("preview");
                setReviewed(false);
                setSelected(new Set());
                knownValid.current.clear();
              } else if (jobId) void refresh();
            }}
          />
        </div>
      }
    />
  );
}
