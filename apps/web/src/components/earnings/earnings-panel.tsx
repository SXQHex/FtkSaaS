"use client";
import dynamic from "next/dynamic";
import { useEffect, useId, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { P03PaymentView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { earningsApi, type EarningsApi } from "../../lib/earnings";
import { calendarInterval, dateInZone, type CalendarRange } from "../../lib/schedule";
import { effectMoney } from "../../lib/effect-money";
import type { SetupScope } from "../../lib/studio-setup";
import { FlowError, flowError } from "../bookings/flow-controls";
const PaymentForm = dynamic(() =>
  import("./instructor-payment-form").then((m) => m.InstructorPaymentForm),
);
const EarningsReport = dynamic(() => import("./earnings-report").then((m) => m.EarningsReport));
const button = "h-auto min-h-11 max-w-full whitespace-normal";
export function EarningsPanel(props: {
  scope: SetupScope;
  personId: string;
  timeZone: string;
  management?: boolean;
  api?: EarningsApi;
}) {
  return (
    <EarningsQuery
      key={JSON.stringify([props.scope, props.personId, props.timeZone, props.management])}
      {...props}
    />
  );
}
function EarningsQuery({
  scope: initialScope,
  personId,
  timeZone,
  management = false,
  api = earningsApi,
}: Parameters<typeof EarningsPanel>[0]) {
  const [scope] = useState(initialScope),
    t = useTranslations("earnings"),
    f = useFormatter(),
    locale = useLocale(),
    id = useId();
  const [open, setOpen] = useState(false),
    [date, setDate] = useState(() => dateInZone(new Date(), timeZone)),
    [range, setRange] = useState<CalendarRange>("week");
  const query = JSON.stringify([date, range]);
  return (
    <section aria-label={t("title")} className="min-w-0 space-y-3 border-t pt-4 wrap-anywhere">
      <Button
        className={button}
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("title")}
      </Button>
      {open && (
        <>
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
          <p>
            {t("personId")} {personId}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${id}-date`}>{t("date")}</Label>
              <Input
                id={`${id}-date`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-range`}>{t("range")}</Label>
              <select
                id={`${id}-range`}
                className="min-h-11 w-full rounded-md border bg-background px-3"
                value={range}
                onChange={(e) => setRange(e.target.value as CalendarRange)}
              >
                <option value="day">{t("day")}</option>
                <option value="week">{t("week")}</option>
              </select>
            </div>
          </div>
          {/^\d{4}-\d\d-\d\d$/.test(date) && (
            <EarningsPage
              key={query}
              scope={scope}
              personId={personId}
              timeZone={timeZone}
              management={management}
              api={api}
              interval={calendarInterval(date, range, timeZone)}
              formatMoney={(amount, currency) => effectMoney(amount, currency, locale)}
              formatTime={(time) =>
                f.dateTime(new Date(time), { timeZone, dateStyle: "medium", timeStyle: "short" })
              }
            />
          )}
        </>
      )}
    </section>
  );
}
function EarningsPage({
  scope,
  personId,
  timeZone,
  management,
  api,
  interval,
  formatMoney,
  formatTime,
}: {
  scope: SetupScope;
  personId: string;
  timeZone: string;
  management: boolean;
  api: EarningsApi;
  interval: ReturnType<typeof calendarInterval>;
  formatMoney: (amount: string, currency: string) => string;
  formatTime: (time: string) => string;
}) {
  const t = useTranslations("earnings"),
    [cursor, setCursor] = useState<string>(),
    [attempt, setAttempt] = useState(0),
    [result, setResult] = useState<{
      data?: Awaited<ReturnType<EarningsApi["list"]>>;
      error?: string;
    } | null>(null),
    [editing, setEditing] = useState<{ payment?: P03PaymentView } | null>(null),
    [report, setReport] = useState(false),
    [lastError, setLastError] = useState("");
  useEffect(() => {
    const life = new AbortController();
    void api
      .list(scope, personId, interval, cursor)
      .then((data) => {
        if (!life.signal.aborted) setResult({ data });
      })
      .catch((e) => {
        if (!life.signal.aborted) setResult({ error: flowError(e) });
      });
    return () => life.abort();
  }, [api, scope, personId, interval, cursor, attempt]);
  function reload(code = "") {
    setLastError(code);
    setEditing(null);
    setReport(false);
    setResult(null);
    setCursor(undefined);
    setAttempt((n) => n + 1);
  }
  const payments = new Map<string, P03PaymentView>();
  for (const row of result?.data?.items ?? [])
    for (const payment of row.payments ?? []) payments.set(payment.id, payment);
  return (
    <div className="space-y-3">
      {lastError && <FlowError code={lastError} />}
      <p>
        {formatTime(interval.starts_at)} — {formatTime(interval.ends_at)}
      </p>
      <Button className={button} variant="outline" onClick={() => reload()}>
        {t("reload")}
      </Button>
      {!result ? (
        <output aria-live="polite">{t("loading")}</output>
      ) : result.error ? (
        <FlowError code={result.error} />
      ) : (
        result.data && (
          <>
            <p className="text-sm">
              {t("asOf")} {formatTime(result.data.as_of)}
            </p>
            {!result.data.items.length && <p>{t("empty")}</p>}
            <ul className="space-y-3">
              {result.data.items.map((row) => (
                <li key={row.id} className="space-y-2 rounded-md border p-3">
                  <p>
                    {t(row.direction)} · {formatMoney(row.amount_minor, row.currency)}
                  </p>
                  <p>
                    {t("paid")}: {formatMoney(row.paid_minor, row.currency)} · {t("remaining")}:{" "}
                    {formatMoney(row.remaining_minor, row.currency)}
                  </p>
                  <p>
                    {t("overpaid")}:{" "}
                    {row.overpaid_minor !== undefined
                      ? formatMoney(row.overpaid_minor, row.currency)
                      : t("unknown")}
                  </p>
                  <p>
                    {t(`sources.${row.basis.source}`)} ·{" "}
                    {t("quantity", { count: row.basis.quantity })} ·{" "}
                    {t("blocked", { count: row.basis.excluded_blocked })}
                  </p>
                  <p>
                    {t("agreementId")}: {row.basis.agreement_id ?? t("unknown")}
                  </p>
                  <p>
                    {t("sessionId")}: {row.session_id ?? t("unknown")}
                  </p>
                  {row.previous_id && (
                    <p>
                      {t("previousId")}: {row.previous_id}
                    </p>
                  )}
                  <p>
                    {formatTime(row.created_at)} · {t("version", { version: row.version })}
                  </p>
                </li>
              ))}
            </ul>
            <h4 className="font-semibold">{t("paymentHistory")}</h4>
            {!payments.size && (
              <p>
                {t(
                  result.data.items.some((r) => r.payments === undefined)
                    ? "unknownHistory"
                    : "noPayments",
                )}
              </p>
            )}
            <ul className="space-y-3">
              {[...payments.values()].map((payment) => (
                <li key={payment.id} className="space-y-2 rounded-md border p-3">
                  <p>
                    {formatMoney(payment.amount_minor, payment.currency)} · {t("net")}:{" "}
                    {formatMoney(payment.net_minor, payment.currency)}
                  </p>
                  <p>
                    {formatTime(payment.occurred_at)} · {t("version", { version: payment.version })}
                  </p>
                  <ul>
                    {payment.corrections.map((c) => (
                      <li key={c.id}>
                        {t(c.direction)} {formatMoney(c.amount_minor, payment.currency)} ·{" "}
                        {formatTime(c.occurred_at)} · {c.reason}
                      </li>
                    ))}
                  </ul>
                  {management && !editing && (
                    <Button
                      className={button}
                      variant="outline"
                      onClick={() => setEditing({ payment })}
                    >
                      {t("correctPayment")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {management && !editing && (
              <Button className={button} onClick={() => setEditing({})}>
                {t("recordPayment")}
              </Button>
            )}
            {editing && management && (
              <PaymentForm
                key={editing.payment?.id ?? "new"}
                scope={scope}
                personId={personId}
                timeZone={timeZone}
                rows={result.data.items}
                payment={editing.payment}
                onSaved={reload}
                onCancel={() => setEditing(null)}
              />
            )}
            {!editing && result.data.next_cursor && (
              <Button
                className={button}
                variant="outline"
                onClick={() => {
                  setCursor(result.data!.next_cursor!);
                  setResult(null);
                  setReport(false);
                }}
              >
                {t("next")}
              </Button>
            )}
            <p className="text-sm text-muted-foreground">{t("pageHint")}</p>
            {management && !editing && (
              <Button
                className={button}
                variant="outline"
                aria-expanded={report}
                onClick={() => setReport((v) => !v)}
              >
                {t("report")}
              </Button>
            )}
            {report && !editing && (
              <EarningsReport
                key={attempt}
                scope={scope}
                personId={personId}
                interval={interval}
                api={api}
              />
            )}
          </>
        )
      )}
    </div>
  );
}
