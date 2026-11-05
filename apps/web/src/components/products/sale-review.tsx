"use client";
import { useEffect, useRef, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { effectMoney } from "../../lib/effect-money";
import { FlowError } from "../bookings/flow-controls";
export function SaleReview({
  preview,
  disabled,
  onApply,
  onBack,
}: {
  preview: Preview;
  disabled: boolean;
  onApply: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("flows"),
    format = useFormatter(),
    locale = useLocale(),
    action = useTranslations("program.action"),
    [confirmed, setConfirmed] = useState(false),
    [expired, setExpired] = useState(() => !(Date.parse(preview.expires_at) > Date.now())),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, Math.min(2147483647, Date.parse(preview.expires_at) - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [preview.expires_at]);
  const blocked = disabled || expired || preview.blockers.length > 0;
  return (
    <section
      className="min-w-0 space-y-4 rounded-md border p-4 wrap-anywhere"
      aria-label={t("review")}
    >
      <h4 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {t("review")}
      </h4>
      <p>{t("renewalHint")}</p>
      {preview.sale_lifecycle && (
        <>
          <p>
            {preview.sale_lifecycle.start_date} — {preview.sale_lifecycle.end_date}
          </p>
          <p>
            {t("gap", { count: preview.sale_lifecycle.gap_days })} ·{" "}
            {t("overlap", { count: preview.sale_lifecycle.overlap_days })}
          </p>
        </>
      )}
      <p>
        {t("expires", {
          date: format.dateTime(new Date(preview.expires_at), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        })}
      </p>
      {expired && <FlowError code="PREVIEW_STALE" />}
      {preview.blockers.map((item, i) => (
        <FlowError key={i} code={item.code} />
      ))}
      <ul className="space-y-3 text-sm">
        {preview.effects.map((effect, i) => (
          <li className="rounded-md border p-3" key={i}>
            <p>{action(effect.action)}</p>
            {effect.amount_minor != null && effect.currency && (
              <p>{effectMoney(effect.amount_minor, effect.currency, locale)}</p>
            )}
            {effect.quantity != null && <p>{effect.quantity}</p>}
          </li>
        ))}
      </ul>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={blocked}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        {t("confirm")}
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal"
          disabled={blocked || !confirmed}
          onClick={() => {
            if (!(Date.parse(preview.expires_at) > Date.now())) setExpired(true);
            else onApply();
          }}
        >
          {t("apply")}
        </Button>
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal"
          variant="outline"
          disabled={disabled}
          onClick={onBack}
        >
          {t("back")}
        </Button>
      </div>
    </section>
  );
}
