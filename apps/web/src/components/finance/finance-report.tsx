"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useDisplayMoney } from "../display-format";
import { useEffect, useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { financeReportApi, type FinanceReportApi } from "../../lib/finance-report";
import { calendarInterval, dateInZone, type CalendarRange } from "../../lib/schedule";
import type { SetupScope } from "../../lib/studio-setup";
import { FlowError, flowError } from "../bookings/flow-controls";
export function FinanceReport({
  scope,
  personId,
  currency,
  timeZone,
  api = financeReportApi,
}: {
  scope: SetupScope;
  personId: string;
  currency: string;
  timeZone: string;
  api?: FinanceReportApi;
}) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("financeReport"),
    f = useFormatter(),
    locale = useLocale(),
    id = useId();
  const [date, setDate] = useState(() => dateInZone(new Date(), timeZone)),
    [range, setRange] = useState<CalendarRange>("week"),
    [cursor, setCursor] = useState<string>(),
    [attempt, setAttempt] = useState(0),
    [result, setResult] = useState<{
      key: string;
      data?: Awaited<ReturnType<FinanceReportApi["read"]>>;
      error?: string;
    }>();
  const interval = useMemo(
    () => (/^\d{4}-\d\d-\d\d$/.test(date) ? calendarInterval(date, range, timeZone) : null),
    [date, range, timeZone],
  );
  const key = JSON.stringify([scope, personId, currency, interval, cursor, attempt]);
  const current = result?.key === key ? result : undefined;
  useEffect(() => {
    if (!interval) return;
    const life = new AbortController();
    void api
      .read(scope, personId, currency, interval, cursor)
      .then((data) => {
        if (!life.signal.aborted) setResult({ key, data });
      })
      .catch((e) => {
        if (!life.signal.aborted) setResult({ key, error: flowError(e) });
      });
    return () => {
      life.abort();
    };
  }, [api, scope, personId, currency, interval, cursor, key]);
  return (
    <section
      aria-label={t("title")}
      className="min-w-0 space-y-3 rounded-md border p-3 wrap-anywhere"
    >
      <h4 className="font-semibold">{t("title")}</h4>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <p>
        {timeZone} · {currency}
      </p>
      <Label htmlFor={`${id}-date`}>{t("date")}</Label>
      <Input
        id={`${id}-date`}
        type="date"
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          setCursor(undefined);
        }}
      />
      <Label htmlFor={`${id}-range`}>{t("range")}</Label>
      <select
        id={`${id}-range`}
        value={range}
        onChange={(e) => {
          setRange(e.target.value as CalendarRange);
          setCursor(undefined);
        }}
        className="min-h-11 rounded-md border bg-background px-3"
      >
        <option value="day">{t("day")}</option>
        <option value="week">{t("week")}</option>
      </select>
      <Button
        variant="outline"
        onClick={() => {
          setCursor(undefined);
          setAttempt((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {interval && (
        <p>
          {f.dateTime(new Date(interval.starts_at), {
            timeZone,
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          —{" "}
          {f.dateTime(new Date(interval.ends_at), {
            timeZone,
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
      {interval && !current && <output aria-live="polite">{t("loading")}</output>}
      {current?.error && <FlowError code={current.error} />}
      {current?.data && (
        <>
          <p>
            {t("asOf")}{" "}
            {f.dateTime(new Date(current.data.as_of), {
              timeZone,
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          {!current.data.rows.items.length && <p>{t("empty")}</p>}
          <ul>
            {current.data.rows.items.map((row) => (
              <li key={`${row.group_key}:${row.center_id}:${row.person_id}:${row.currency}`}>
                {t(row.group_key)} · {effectMoney(row.amount_minor!, row.currency!, locale)} ·{" "}
                {t("count", { count: row.count! })}
              </li>
            ))}
          </ul>
          <h5 className="font-semibold">{t("totals")}</h5>
          <ul>
            {current.data.totals.map((row) => (
              <li key={`${row.group_key}:${row.currency}`}>
                {t(row.group_key!)} · {effectMoney(row.amount_minor!, row.currency!, locale)} ·{" "}
                {t("count", { count: row.count })}
              </li>
            ))}
          </ul>
          {current.data.rows.next_cursor && (
            <Button variant="outline" onClick={() => setCursor(current.data!.rows.next_cursor!)}>
              {t("next")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
