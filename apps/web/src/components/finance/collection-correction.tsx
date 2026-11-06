"use client";
import dynamic from "next/dynamic";
import { useEffect, useId, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { CashSummary } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import { correctionApi, type CorrectionApi } from "../../lib/collection-correction";
import { effectMoney } from "../../lib/effect-money";
import type { SetupScope } from "../../lib/studio-setup";
const CorrectionForm = dynamic(() =>
  import("./correction-form").then((module) => module.CorrectionForm),
);
export function CollectionCorrection({
  scope,
  movements,
  timeZone,
  onSaved,
  api = correctionApi,
}: {
  scope: SetupScope;
  movements: CashSummary[];
  timeZone: string;
  onSaved: () => void;
  api?: CorrectionApi;
}) {
  const t = useTranslations("finance"),
    format = useFormatter(),
    locale = useLocale(),
    id = useId();
  const collections = movements.filter((row) => row.kind === "collection");
  const [selected, setSelected] = useState(collections[0]?.id ?? ""),
    [attempt, setAttempt] = useState(0);
  const [access, setAccess] = useState<{ id: string; allowed?: boolean; failed?: boolean } | null>(
    null,
  );
  const movement = collections.find((row) => row.id === selected);
  useEffect(() => {
    if (!movement) return;
    const lifetime = new AbortController();
    void api
      .canCorrect(scope, movement.id)
      .then((allowed) => {
        if (!lifetime.signal.aborted) setAccess({ id: movement.id, allowed });
      })
      .catch(() => {
        if (!lifetime.signal.aborted) setAccess({ id: movement.id, failed: true });
      });
    return () => {
      lifetime.abort();
    };
  }, [scope, movement, api, attempt]);
  const current = movement && access?.id === movement.id ? access : null;
  if (!collections.length) return null;
  return (
    <section className="min-w-0 space-y-4 border-t pt-4" aria-label={t("sourceCollection")}>
      <div className="space-y-2">
        <Label htmlFor={id}>{t("sourceCollection")}</Label>
        <select
          id={id}
          className="min-h-11 w-full rounded-md border bg-background px-3"
          value={selected}
          onChange={(event) => {
            setAccess(null);
            setSelected(event.target.value);
          }}
        >
          {collections.map((row, index) => (
            <option key={row.id} value={row.id}>
              {t("collectionNumber", { number: index + 1 })} ·{" "}
              {format.dateTime(new Date(row.occurred_at), {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone,
              })}{" "}
              · {effectMoney(row.amount_minor, row.currency, locale)}
            </option>
          ))}
        </select>
      </div>
      {!current && <output aria-live="polite">{t("loading")}</output>}
      {current?.failed && (
        <div className="space-y-3">
          <p role="alert">{t("correctionPermissionFailed")}</p>
          <Button
            variant="outline"
            onClick={() => {
              setAccess(null);
              setAttempt((n) => n + 1);
            }}
          >
            {t("retryPermission")}
          </Button>
        </div>
      )}
      {current?.allowed && movement && (
        <>
          <h4 className="font-semibold">{t("correction")}</h4>
          <CorrectionForm
            key={selected}
            scope={scope}
            movement={movement}
            timeZone={timeZone}
            onSaved={onSaved}
            api={api}
          />
        </>
      )}
    </section>
  );
}
