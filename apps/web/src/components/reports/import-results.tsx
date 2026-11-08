"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useDisplayMoney } from "../display-format";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { JobStatusView } from "@ftksaas/api-contracts";
import Link from "next/link";
import { personPath } from "../../lib/person-route";
import { validate, v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { setupCall, type SetupCommand, type SetupScope } from "../../lib/studio-setup";
import { restoreJob } from "../../lib/job-record";
import { useRemote } from "../../lib/use-remote";
import { JobProgress } from "./job-progress";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { ConfirmWrite, FlowError } from "../bookings/flow-controls";
export function ImportResults({
  scope,
  previewJob,
  onCanRestart,
}: {
  scope: SetupScope;
  previewJob: string;
  onCanRestart?: (ready: boolean) => void;
}) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("reports"),
    locale = useLocale(),
    format = useFormatter(),
    [job, setJob] = useState<JobStatusView | null>(null),
    [applied, setApplied] = useState<string | null>(() => {
      try {
        const id = restoreJob(scope, `import-apply:${scope.centerId}`);
        return id === previewJob ? id : null;
      } catch {
        return null;
      }
    }),
    [revision, setRevision] = useState(0),
    [clock, setClock] = useState(() => Date.now()),
    [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState("");
  const onRead = useCallback((j: JobStatusView | null) => {
      setJob(j);
      if (!j) {
        setReview(null);
      }
    }, []),
    load = useCallback(async () => {
      if (!job || job.state !== "succeeded" || job.result_reference?.type !== "previews")
        return null;
      const p = await setupCall("preview_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        preview_id: job.result_reference.id,
      });
      if (
        p.id !== job.result_reference.id ||
        !p.import_summary ||
        p.import_summary.import_kind === "crm_applications"
      )
        throw Error("invalidImport");
      return p;
    }, [scope, job]);
  const state = useRemote(
    load,
    JSON.stringify([job?.id, job?.state, job?.result_reference, revision]),
  );
  const command = useSetupCommand(
    scope,
    `import-apply:${scope.centerId}`,
    (id) => {
      if (id && id !== previewJob) {
        setError("anotherImport");
        return;
      }
      if (id) {
        setJob(null);
        setApplied(id);
        setReview(null);
        setRevision((v) => v + 1);
      }
    },
    setError,
  );
  useEffect(() => {
    onCanRestart?.(
      !command.busy &&
        !command.pending &&
        !!job &&
        ["succeeded", "failed", "cancelled"].includes(job.state),
    );
  }, [onCanRestart, command.busy, command.pending, job]);
  useEffect(() => {
    if (!state?.data) return;
    const timer = setTimeout(
      () => {
        setClock(Date.now());
        setReview(null);
      },
      Math.max(0, Math.min(2147483647, Date.parse(state.data.expires_at) - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [state?.data]);
  const p = state?.data,
    s = p?.import_summary;
  return (
    <section className="space-y-4">
      <JobProgress
        key={`${applied ? "apply" : "preview"}:${revision}`}
        scope={scope}
        id={applied ?? previewJob}
        onRead={onRead}
      />
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      {state?.error && <FlowError code={state.error} />}
      {p && s && (
        <>
          <h3 className="font-semibold">{t("preview")}</h3>
          <p>
            {t("counts", {
              total: s.total_rows,
              valid: s.valid_rows,
              invalid: s.invalid_rows,
              people: s.new_people,
              replayed: s.replayed_rows,
            })}
          </p>
          <p>
            {t("credits", { count: s.opening_credits })} ·{" "}
            {t("negativeCredits", { count: s.existing_negative_credits })}
          </p>
          {s.opening_debt_totals.map((m) => (
            <p key={m.currency}>
              {t("openingDebt")}: {effectMoney(m.amount_minor, m.currency, locale)}
            </p>
          ))}
          {s.original_credit_basis_totals.map((m) => (
            <p key={m.currency}>
              {t("originalValue")}: {effectMoney(m.amount_minor, m.currency, locale)}
            </p>
          ))}
          <p>
            {t("expires")}{" "}
            {format.dateTime(new Date(p.expires_at), { dateStyle: "medium", timeStyle: "short" })}
          </p>
          {p.blockers.map((b, i) => (
            <FlowError key={i} code={b.code} />
          ))}
          {!applied && (
            <ImportRows key={`${previewJob}:${revision}`} scope={scope} jobId={previewJob} />
          )}
          {!applied && (
            <Button
              disabled={
                command.busy ||
                !!command.pending ||
                p.blockers.length > 0 ||
                !s.valid_rows ||
                Date.parse(p.expires_at) <= clock
              }
              onClick={() => {
                if (Date.parse(p.expires_at) <= Date.now()) {
                  setError("PREVIEW_STALE");
                  return;
                }
                setReview({
                  operation: "import_apply_v1",
                  input: {
                    org_id: scope.orgId,
                    center_id: scope.centerId,
                    operation_key: v7(),
                    preview: { id: p.id, token: p.token },
                  },
                });
              }}
            >
              {t("reviewApply")}
            </Button>
          )}
          {review && (
            <ConfirmWrite
              key={review.input.operation_key}
              command={review}
              controller={command}
              onBack={() => setReview(null)}
            >
              <p>{t("importHint")}</p>
              <p>
                {t("counts", {
                  total: s.total_rows,
                  valid: s.valid_rows,
                  invalid: s.invalid_rows,
                  people: s.new_people,
                  replayed: s.replayed_rows,
                })}
              </p>
              <p>{t("credits", { count: s.opening_credits })}</p>
              {s.opening_debt_totals.map((m) => (
                <p key={m.currency}>
                  {t("openingDebt")}: {effectMoney(m.amount_minor, m.currency, locale)}
                </p>
              ))}
            </ConfirmWrite>
          )}
        </>
      )}
      {applied &&
        job?.id === applied &&
        (job.state !== "succeeded" ||
          (job.result_reference?.type === "import_jobs" &&
            job.result_reference.id === applied)) && (
          <>
            <output>{t("applyQueued")}</output>
            <ImportRows key={`apply:${revision}`} scope={scope} jobId={applied} />
          </>
        )}
    </section>
  );
}
export function ImportRows({ scope, jobId }: { scope: SetupScope; jobId: string }) {
  const t = useTranslations("reports"),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    const page = await setupCall("import_rows_list_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      job_id: jobId,
      page: { limit: 25, ...(cursor ? { cursor } : {}) },
    });
    if (
      (cursor && page.next_cursor === cursor) ||
      new Set(page.items.map((r) => r.row_number)).size !== page.items.length
    )
      throw Error("invalidImport");
    return page;
  }, [scope, jobId, cursor]);
  const state = useRemote(load, JSON.stringify([scope, jobId, cursor, revision]));
  return (
    <section className="space-y-3">
      <h4 className="font-semibold">{t("rows")}</h4>
      <Button
        variant="outline"
        onClick={() => {
          setCursor(undefined);
          setRevision((n) => n + 1);
        }}
      >
        {t("refresh")}
      </Button>
      {state?.error ? (
        <FlowError code={state.error} />
      ) : !state ? (
        <output>{t("loading")}</output>
      ) : (
        <ul className="space-y-2">
          {state.data?.items.map((r) => (
            <li key={r.row_number} className="rounded-md border p-3">
              <p>
                {t("row", { number: r.row_number })} · {t(`rowStates.${r.state}`)}
              </p>
              {r.error_code && <FlowError code={r.error_code} />}
              {r.created_references.length > 0 && (
                <p>{t("references", { count: r.created_references.length })}</p>
              )}
              {r.state === "applied" &&
                scope.centerId &&
                r.created_references
                  .filter((ref) => ref.type === "people" && validate(ref.id))
                  .map((ref) => (
                    <Link
                      className="block underline"
                      key={ref.id}
                      href={personPath(scope.orgId, scope.centerId!, ref.id)}
                    >
                      {t("openPersonResult")}
                    </Link>
                  ))}
            </li>
          ))}
        </ul>
      )}
      {state?.data?.next_cursor && (
        <Button variant="outline" onClick={() => setCursor(state.data!.next_cursor!)}>
          {t("next")}
        </Button>
      )}
    </section>
  );
}
