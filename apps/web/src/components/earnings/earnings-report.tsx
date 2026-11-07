"use client";
import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { Interval } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import type { SetupScope } from "../../lib/studio-setup";
import { earningsApi, type EarningsApi } from "../../lib/earnings";
import { effectMoney } from "../../lib/effect-money";
import { FlowError, flowError } from "../bookings/flow-controls";
export function EarningsReport({
  scope,
  personId,
  interval,
  api = earningsApi,
}: {
  scope: SetupScope;
  personId: string;
  interval: Interval;
  api?: EarningsApi;
}) {
  const t = useTranslations("earnings"),
    f = useFormatter(),
    locale = useLocale();
  const [cursor, setCursor] = useState<string>(),
    [attempt, setAttempt] = useState(0),
    [result, setResult] = useState<{
      data?: Awaited<ReturnType<EarningsApi["report"]>>;
      error?: string;
    } | null>(null);
  useEffect(() => {
    const life = new AbortController();
    void api
      .report(scope, personId, interval, cursor)
      .then((data) => {
        if (!life.signal.aborted) setResult({ data });
      })
      .catch((e) => {
        if (!life.signal.aborted) setResult({ error: flowError(e) });
      });
    return () => life.abort();
  }, [api, scope, personId, interval, cursor, attempt]);
  return (
    <section
      aria-label={t("report")}
      className="min-w-0 space-y-3 rounded-md border p-3 wrap-anywhere"
    >
      <h4 className="font-semibold">{t("report")}</h4>
      <p className="text-sm text-muted-foreground">{t("reportHint")}</p>
      <Button
        variant="outline"
        className="h-auto min-h-11 max-w-full whitespace-normal"
        onClick={() => {
          setResult(null);
          setCursor(undefined);
          setAttempt((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {!result ? (
        <output>{t("loading")}</output>
      ) : result.error ? (
        <FlowError code={result.error} />
      ) : (
        result.data && (
          <>
            <p>
              {t("asOf")}{" "}
              {f.dateTime(new Date(result.data.as_of), { dateStyle: "medium", timeStyle: "short" })}
            </p>
            <ul className="space-y-2">
              {result.data.rows.items.map((row) => (
                <li key={row.group_key}>
                  {row.group_key} ·{" "}
                  {row.currency && row.amount_minor !== null && row.amount_minor !== undefined
                    ? effectMoney(row.amount_minor, row.currency, locale)
                    : t("unknown")}{" "}
                  ·{" "}
                  {row.count === undefined || row.count === null
                    ? t("unknown")
                    : t("count", { count: row.count })}
                </li>
              ))}
            </ul>
            <h5 className="font-semibold">{t("reportTotals")}</h5>
            <ul>
              {result.data.totals.map((total, index) => (
                <li key={`${total.currency}:${total.group_key}:${index}`}>
                  {total.currency && total.amount_minor !== null && total.amount_minor !== undefined
                    ? effectMoney(total.amount_minor, total.currency, locale)
                    : t("unknown")}{" "}
                  · {t("count", { count: total.count })}
                </li>
              ))}
            </ul>
            {result.data.rows.next_cursor && (
              <Button
                className="h-auto min-h-11 max-w-full whitespace-normal"
                variant="outline"
                onClick={() => {
                  setCursor(result.data!.rows.next_cursor!);
                  setResult(null);
                }}
              >
                {t("next")}
              </Button>
            )}
          </>
        )
      )}
    </section>
  );
}
