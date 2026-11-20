import { useEffect, useState } from "react";
import { v7 as uuidv7 } from "uuid";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { ReportFilters, ReportKind } from "@ftksaas/api-contracts";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { ReportExportSheet, type ExportReportKind } from "./report-sheets";
import {
  reportsCommon,
  writeReportJob,
  reportJobReceipt,
  readReportJob,
  type ReportJobIntent,
} from "./reports-command";
export function ReportExportEditor({
  scope,
  review: initialReview,
  onClose,
  onLockChange,
  onAccessLost,
  onSaved,
}: {
  scope: ClientScope;
  review: { filters: ReportFilters; period: string } | { retry: { id: string; date: string } };
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [review] = useState(initialReview);
  const retry = "retry" in review ? review.retry : undefined;
  const [kind, setKind] = useState<ExportReportKind | "">("");
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState(false);
  const command = useMemberCommand({
    write: writeReportJob,
    readReceipt: reportJobReceipt,
    readResult: readReportJob,
    onAccessLost,
    onRefresh: async () => onSaved(),
  });
  useEffect(() => {
    onLockChange(command.locked);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);
  const names: Partial<Record<ExportReportKind, ReportKind>> = {
    summary: "sales",
    collections: "collections_debts",
    earnings: "instructor_balances",
    crm: "crm_conversion",
  };
  function start() {
    const report = kind ? names[kind] : undefined;
    if (!reviewed || command.locked || command.state === "saved") return;
    const base = { ...reportsCommon(scope), operation_key: uuidv7() };
    if ("retry" in review) {
      void command.start({
        scope: { ...scope },
        operation: "report_export_start_v1",
        request: { ...base, retry_job_id: review.retry.id },
      });
      return;
    }
    if (!report) {
      setError(true);
      return;
    }
    const intent: ReportJobIntent = {
      scope: { ...scope },
      operation: "report_export_start_v1",
      request: {
        ...base,
        report,
        filters: structuredClone(review.filters),
        format: "csv",
        ...(["sales", "instructor_balances"].includes(report)
          ? {
              columns: [
                "group_key",
                "display_name",
                "product_name",
                "period_start",
                "currency",
                "count",
                "amount_minor",
              ] as const,
            }
          : {}),
      },
    };
    void command.start(intent);
  }
  return (
    <ReportExportSheet
      kind={kind}
      onKind={(value) => {
        if (!command.locked) {
          command.reset();
          setKind(value);
          setReviewed(false);
          setError(false);
        }
      }}
      period={"period" in review ? review.period : review.retry.date}
      retry={Boolean(retry)}
      fileDescription={t(($) => $.reports.nativeFiles)}
      preparation={t(($) => $.reports.exportAsync)}
      reviewed={reviewed}
      onReviewed={setReviewed}
      onStart={start}
      onClose={onClose}
      locked={command.locked}
      canStart={
        Boolean(retry || (kind && names[kind])) &&
        reviewed &&
        !command.unavailable &&
        command.state !== "saved"
      }
      unsupported={["debtors"]}
      error={error ? t(($) => $.reports.chooseExport) : undefined}
      notice={
        <>
          <p className="text-sm">
            {t(($) => (retry ? $.reports.exportRetryScope : $.reports.exportScope))}
          </p>
          <EventCommandNotice command={command} onReload={() => command.reset()} />
        </>
      }
    />
  );
}
