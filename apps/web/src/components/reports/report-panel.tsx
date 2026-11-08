"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useDisplayMoney } from "../display-format";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  ReportFilters,
  ReportKind,
  ReportRow,
  ReportTotal,
  JobStatusView,
  PersonSummary,
} from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import {
  downloadReport,
  readReport,
  reportKinds,
  validReportFilters,
  type ReportLayout,
} from "../../lib/reports";
import { calendarInterval, dateInZone } from "../../lib/schedule";
import { restoreJob, reportBinding } from "../../lib/job-record";
import { useRemote } from "../../lib/use-remote";
import type { SetupCommand, SetupScope } from "../../lib/studio-setup";
import { PersonChooser } from "../bookings/person-chooser";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { JobProgress } from "./job-progress";
import { WorkTemplatePicker } from "./work-template-picker";
export function ReportPanel({ scope, timeZone }: { scope: SetupScope; timeZone: string }) {
  const t = useTranslations("reports"),
    id = useId(),
    [start, setStart] = useState(() => dateInZone(new Date(), timeZone)),
    [end, setEnd] = useState(start),
    [currency, setCurrency] = useState(""),
    [kind, setKind] = useState<ReportKind>("collections_debts"),
    [person, setPerson] = useState<PersonSummary | null>(null),
    [choosePerson, setChoosePerson] = useState(false),
    [query, setQuery] = useState<{
      kind: ReportKind;
      filters: ReportFilters;
      layout: ReportLayout;
    } | null>(null),
    [error, setError] = useState("");
  return (
    <section className="min-w-0 space-y-5 wrap-anywhere">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <WorkTemplatePicker
        contextKey={JSON.stringify([start, end, kind, currency, person?.id, choosePerson])}
        scope={scope}
        kind="report"
        onResolved={(r) => {
          if (r.kind !== "report") return;
          if (
            (r.request.center_id != null && r.request.center_id !== scope.centerId) ||
            !validReportFilters(r.request.filters, scope.centerId)
          ) {
            setError("invalidReport");
            return;
          }
          setQuery({
            kind: r.request.report,
            filters: r.request.filters,
            layout: {
              columns: r.request.columns,
              report_order: r.request.report_order,
              group_by: r.request.group_by,
            },
          });
          setError("");
        }}
      />
      <form
        className="space-y-4"
        onChange={() => setQuery(null)}
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(null);
          try {
            const filters: ReportFilters = {
              interval: {
                starts_at: calendarInterval(start, "day", timeZone).starts_at,
                ends_at: calendarInterval(end, "day", timeZone).ends_at,
              },
              center_ids: [scope.centerId!],
              ...(currency.trim() ? { currency: currency.trim().toUpperCase() } : {}),
              ...(choosePerson && person ? { person_ids: [person.id] } : {}),
            };
            if (!validReportFilters(filters, scope.centerId) || (choosePerson && !person))
              throw Error("invalidReport");
            setQuery({ kind, filters, layout: {} });
            setError("");
          } catch (e) {
            setError(flowError(e));
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={id}>{t("kind")}</Label>
            <select
              id={id}
              className="min-h-11 w-full rounded-md border bg-background px-3"
              value={kind}
              onChange={(e) => setKind(e.target.value as ReportKind)}
            >
              {reportKinds.map((k) => (
                <option key={k} value={k}>
                  {t(`kinds.${k}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${id}-currency`}>{t("currency")}</Label>
            <Input
              id={`${id}-currency`}
              maxLength={3}
              placeholder={t("allCurrencies")}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-start`}>{t("start")}</Label>
            <Input
              id={`${id}-start`}
              type="date"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-end`}>{t("end")}</Label>
            <Input
              id={`${id}-end`}
              type="date"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={choosePerson}
            onChange={(e) => {
              setChoosePerson(e.target.checked);
              setPerson(null);
            }}
          />
          {t("personFilter")}
        </label>
        {person && (
          <p>
            {person.display_name} · {person.subscriber_number ?? t("noSubscriberNumber")}
          </p>
        )}
        <p>{timeZone}</p>
        <Button type="submit">{t("read")}</Button>
      </form>
      {choosePerson && (
        <PersonChooser
          scope={scope}
          disabled={false}
          onSelect={(p) => {
            setPerson(p);
            setQuery(null);
          }}
        />
      )}
      {error && <FlowError code={error} />}
      {query && <ReportResults key={JSON.stringify(query)} scope={scope} query={query} />}
    </section>
  );
}
export function ReportResults({
  scope,
  query,
}: {
  scope: SetupScope;
  query: { kind: ReportKind; filters: ReportFilters; layout: ReportLayout };
}) {
  const t = useTranslations("reports"),
    format = useFormatter(),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0),
    [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState(""),
    [job, setJob] = useState<string | null>(() => {
      try {
        return restoreJob(
          scope,
          `report-export:${scope.centerId}`,
          reportBinding({ report: query.kind, filters: query.filters, ...query.layout }),
        );
      } catch {
        return null;
      }
    }),
    [jobState, setJobState] = useState<JobStatusView | null>(null),
    [downloading, setDownloading] = useState(false);
  const alive = useRef(true),
    downloadGeneration = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const load = useCallback(
      () => readReport(scope, query.kind, query.filters, cursor, query.layout),
      [scope, query, cursor],
    ),
    state = useRemote(load, JSON.stringify([scope, query, cursor, revision]));
  const command = useSetupCommand(
      scope,
      `report-export:${scope.centerId}`,
      (id) => {
        if (id) {
          const matching = restoreJob(
            scope,
            `report-export:${scope.centerId}`,
            reportBinding({ report: query.kind, filters: query.filters, ...query.layout }),
          );
          setJob(matching);
          if (!matching) setError("exportDifferentQuery");
        }
        setReview(null);
      },
      setError,
    ),
    onRead = useCallback((j: JobStatusView | null) => {
      downloadGeneration.current++;
      setJobState(j);
    }, []);
  async function download() {
    const ticket = downloadGeneration.current;
    setDownloading(true);
    setError("");
    try {
      if (!job) throw Error("invalidJob");
      if (jobState?.result_reference?.type !== "files") throw Error("invalidJob");
      const blob = await downloadReport(scope, job, jobState.result_reference.id);
      if (!alive.current || ticket !== downloadGeneration.current) return;
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = `report-${job}.csv`;
        document.body.append(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if (alive.current) setError(flowError(e));
    } finally {
      if (alive.current) setDownloading(false);
    }
  }
  return (
    <section className="space-y-4">
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      <Button
        variant="outline"
        onClick={() => {
          setReview(null);
          setCursor(undefined);
          setRevision((n) => n + 1);
        }}
      >
        {t("refresh")}
      </Button>
      {!state ? (
        <output>{t("loading")}</output>
      ) : state.error ? (
        <FlowError code={state.error} />
      ) : (
        state.data && (
          <>
            <h3 className="font-semibold">{t(`kinds.${state.data.report_kind}`)}</h3>
            <p>
              {t("asOf")}{" "}
              {format.dateTime(new Date(state.data.as_of), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <p>
              {format.dateTime(new Date(query.filters.interval.starts_at), {
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              —{" "}
              {format.dateTime(new Date(query.filters.interval.ends_at), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            {!state.data.rows.items.length && <p>{t("empty")}</p>}
            <ul className="grid gap-3 md:grid-cols-2">
              {state.data.rows.items.map((r, i) => (
                <li key={i}>
                  <ReportValues row={r} />
                </li>
              ))}
            </ul>
            <h4 className="font-semibold">{t("totals")}</h4>
            <p className="text-sm text-muted-foreground">{t("totalHint")}</p>
            <ul className="grid gap-3 md:grid-cols-2">
              {state.data.totals.map((r, i) => (
                <li key={i}>
                  <ReportValues row={r} />
                </li>
              ))}
            </ul>
            {state.data.rows.next_cursor && (
              <Button
                variant="outline"
                onClick={() => {
                  setReview(null);
                  setCursor(state.data!.rows.next_cursor!);
                }}
              >
                {t("next")}
              </Button>
            )}
            <Button
              disabled={command.busy || !!command.pending}
              onClick={() =>
                setReview({
                  operation: "report_export_start_v1",
                  input: {
                    org_id: scope.orgId,
                    center_id: scope.centerId,
                    operation_key: v7(),
                    report: query.kind,
                    filters: query.filters,
                    format: "csv",
                    ...query.layout,
                  },
                })
              }
            >
              {t("export")}
            </Button>
            {review && (
              <ConfirmWrite
                key={review.input.operation_key}
                command={review}
                controller={command}
                onBack={() => setReview(null)}
              >
                <p>
                  {t(`kinds.${query.kind}`)} · {t("exportHint")}
                </p>
                <p>{query.filters.currency ?? t("allCurrencies")}</p>
              </ConfirmWrite>
            )}
          </>
        )
      )}
      {job && (
        <>
          <JobProgress key={job} scope={scope} id={job} onRead={onRead} />
          {jobState?.id === job &&
            jobState.state === "succeeded" &&
            jobState.result_reference?.type === "files" && (
              <Button disabled={downloading} onClick={() => void download()}>
                {t("download")}
              </Button>
            )}
        </>
      )}
    </section>
  );
}
export function ReportValues({ row }: { row: ReportRow | ReportTotal }) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("reports"),
    locale = useLocale(),
    format = useFormatter();
  return (
    <dl className="min-w-0 space-y-2 rounded-md border bg-card p-4 wrap-anywhere">
      {row.group_key && (
        <div>
          <dt className="text-sm text-muted-foreground">{t("group")}</dt>
          <dd>
            {t.has(`metrics.${row.group_key}`) ? t(`metrics.${row.group_key}`) : row.group_key}
          </dd>
        </div>
      )}
      {"subscriber_number" in row && row.subscriber_number && (
        <div>
          <dt>{t("subscriber")}</dt>
          <dd>{row.subscriber_number}</dd>
        </div>
      )}
      {row.amount_minor != null && row.currency && (
        <div>
          <dt>{t("amount")}</dt>
          <dd>{effectMoney(row.amount_minor, row.currency, locale)}</dd>
        </div>
      )}
      {row.amount_minor != null && !row.currency && (
        <div>
          <dt>{t("amountMinor")}</dt>
          <dd>
            {row.amount_minor} · {t("currencyNotSelected")}
          </dd>
        </div>
      )}
      {row.count != null && (
        <div>
          <dt>{t("count")}</dt>
          <dd>{format.number(row.count)}</dd>
        </div>
      )}
      {"credits" in row && row.credits != null && (
        <div>
          <dt>{t("creditCount")}</dt>
          <dd>{format.number(row.credits)}</dd>
        </div>
      )}
      {"ratio_bps" in row && row.ratio_bps != null && (
        <div>
          <dt>{t("ratio")}</dt>
          <dd>
            {format.number(row.ratio_bps / 10000, { style: "percent", maximumFractionDigits: 2 })}
          </dd>
        </div>
      )}
      {"basis_count" in row && row.basis_count != null && (
        <div>
          <dt>{t("basis")}</dt>
          <dd>{format.number(row.basis_count)}</dd>
        </div>
      )}
    </dl>
  );
}
