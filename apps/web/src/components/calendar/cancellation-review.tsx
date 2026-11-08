"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useDisplayMoney } from "../display-format";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { errorKey } from "../setup/setup-command";
export function CancellationReview({
  preview,
  timeZone,
  disabled,
  onApply,
  onBack,
}: {
  preview: Preview;
  timeZone: string;
  disabled: boolean;
  onApply: () => void;
  onBack: () => void;
}) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("sessionLifecycle"),
    errors = useTranslations("setup"),
    actions = useTranslations("program.action");
  const format = useFormatter(),
    locale = useLocale();
  const [confirmed, setConfirmed] = useState(false),
    [expired, setExpired] = useState(() => Date.parse(preview.expires_at) <= Date.now());
  useEffect(() => {
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, Math.min(2147483647, Date.parse(preview.expires_at) - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [preview.expires_at]);
  const missingCurrency = preview.effects.some((e) => e.amount_minor != null && !e.currency);
  return (
    <section className="min-w-0 space-y-4" aria-label={t("effects")}>
      <h3 className="font-semibold">{t("effects")}</h3>
      <p className="text-sm text-muted-foreground">
        {t("expires", {
          date: format.dateTime(new Date(preview.expires_at), {
            timeZone,
            dateStyle: "short",
            timeStyle: "short",
          }),
        })}
      </p>
      {expired && <p role="alert">{t("expired")}</p>}
      {missingCurrency && <p role="alert">{t("missingCurrency")}</p>}
      {preview.blockers.map((b, i) => (
        <p role="alert" key={i}>
          {errors(errorKey(b.code))}
        </p>
      ))}
      <ul className="max-h-80 space-y-3 overflow-y-auto text-sm" aria-label={t("effects")}>
        {preview.effects.map((e, i) => {
          return (
            <li className="break-words rounded-md border p-3" key={i}>
              <p>
                {actions(e.action)} ·{" "}
                {t.has(`entity.${e.entity.type}`) ? t(`entity.${e.entity.type}`) : t("record")}
              </p>
              {e.quantity != null && <p>{t("quantity", { count: e.quantity })}</p>}
              {e.amount_minor != null && e.currency && (
                <p>{effectMoney(e.amount_minor, e.currency, locale)}</p>
              )}
              {e.reason && <p className="mt-1 text-muted-foreground">{e.reason}</p>}
            </li>
          );
        })}
      </ul>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled || expired || missingCurrency || !!preview.blockers.length}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {t("confirm")}
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="destructive"
          className="h-auto min-h-11 whitespace-normal transition-colors"
          disabled={
            disabled || !confirmed || expired || missingCurrency || !!preview.blockers.length
          }
          onClick={() => {
            if (Date.parse(preview.expires_at) <= Date.now()) setExpired(true);
            else onApply();
          }}
        >
          {t("apply")}
        </Button>
        <Button type="button" variant="outline" disabled={disabled} onClick={onBack}>
          {t("back")}
        </Button>
      </div>
    </section>
  );
}
