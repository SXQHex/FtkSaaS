"use client";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { FlowError, flowError } from "../bookings/flow-controls";
import {
  operatingFields,
  operatingValue,
  type OperatingApi,
  type OperatingTarget,
  type OperatingKey,
} from "../../lib/operating-settings";
import type { SetupScope } from "../../lib/studio-setup";
export function SettingsHistory({
  scope,
  target,
  api,
}: {
  scope: SetupScope;
  target: OperatingTarget;
  api: OperatingApi;
}) {
  const t = useTranslations("operatingSettings"),
    format = useFormatter(),
    [cursor, setCursor] = useState<string>(),
    [attempt, setAttempt] = useState(0),
    [result, setResult] = useState<{
      page?: Awaited<ReturnType<OperatingApi["history"]>>;
      error?: string;
    } | null>(null);
  useEffect(() => {
    const life = new AbortController();
    void api
      .history(scope, target, cursor)
      .then((page) => {
        if (cursor && page.next_cursor === cursor) throw Error("invalidSettings");
        if (!life.signal.aborted) setResult({ page });
      })
      .catch((cause) => {
        if (!life.signal.aborted) setResult({ error: flowError(cause) });
      });
    return () => life.abort();
  }, [api, scope, target, cursor, attempt]);
  return (
    <section className="space-y-4" aria-label={t("history")}>
      <h4 className="font-semibold">{t("history")}</h4>
      <Button
        variant="outline"
        onClick={() => {
          setResult(null);
          setCursor(undefined);
          setAttempt((v) => v + 1);
        }}
      >
        {t("refresh")}
      </Button>
      {!result ? (
        <output>{t("loading")}</output>
      ) : result.error ? (
        <FlowError code={result.error} />
      ) : (
        result.page && (
          <>
            <ul className="space-y-4">
              {result.page.items.map((row) => (
                <li key={row.id} className="space-y-2 rounded-md border p-3">
                  <p>
                    {format.dateTime(new Date(row.at), {
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p>{row.reason}</p>
                  {(Object.keys(operatingFields) as OperatingKey[])
                    .filter(
                      (key) => operatingValue(row.before, key) !== operatingValue(row.after, key),
                    )
                    .map((key) => (
                      <p key={key}>
                        {t(`fields.${key}`)}:{" "}
                        {String(operatingValue(row.before, key) ?? t("unset"))} →{" "}
                        {String(operatingValue(row.after, key) ?? t("unset"))}
                      </p>
                    ))}
                </li>
              ))}
            </ul>
            {!result.page.items.length && <p>{t("emptyHistory")}</p>}
            {result.page.next_cursor && (
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setCursor(result.page!.next_cursor!);
                }}
              >
                {t("more")}
              </Button>
            )}
          </>
        )
      )}
    </section>
  );
}
