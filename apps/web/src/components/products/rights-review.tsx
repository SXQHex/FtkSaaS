"use client";
import { useEffect, useRef, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReservationProtectionPreview, SessionView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { effectMoney } from "../../lib/effect-money";
import { errorKey } from "../setup/setup-command";
export function RightsReview({
  result,
  sessions,
  disabled,
  onApply,
  onBack,
}: {
  result: ReservationProtectionPreview;
  sessions: SessionView[];
  disabled: boolean;
  onApply: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("rights"),
    errors = useTranslations("setup"),
    actions = useTranslations("program.action"),
    format = useFormatter(),
    locale = useLocale();
  const [accepted, setAccepted] = useState<string[]>([]),
    [confirmed, setConfirmed] = useState(false),
    [expired, setExpired] = useState(() => !(Date.parse(result.preview.expires_at) > Date.now()));
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, Math.min(2147483647, Date.parse(result.preview.expires_at) - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [result.preview.expires_at]);
  const missingCurrency = result.preview.effects.some(
    (effect) => effect.amount_minor != null && !effect.currency,
  );
  const blocked = disabled || expired || missingCurrency || result.preview.blockers.length > 0;
  return (
    <section aria-label={t("review")} className="min-w-0 space-y-4 wrap-anywhere">
      <h5 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {t("review")}
      </h5>
      <p>{t("preservation")}</p>
      <p className="text-sm">
        {t("expires", {
          date: format.dateTime(new Date(result.preview.expires_at), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        })}
      </p>
      {expired && <p role="alert">{errors("PREVIEW_STALE")}</p>}
      {missingCurrency && <p role="alert">{t("invalidPreview")}</p>}
      {result.preview.blockers.map((item, i) => (
        <p role="alert" key={i}>
          {errors(errorKey(item.code))}
        </p>
      ))}
      <ul className="space-y-2 text-sm" aria-label={t("effects")}>
        {result.preview.effects.map((effect, i) => (
          <li key={i} className="rounded-md border p-3">
            <p>
              {actions(effect.action)} ·{" "}
              {t.has(`entities.${effect.entity.type}`)
                ? t(`entities.${effect.entity.type}`)
                : t("record")}
            </p>
            {effect.quantity != null && <p>{t("quantity", { count: effect.quantity })}</p>}
            {effect.amount_minor != null && effect.currency && (
              <p>{effectMoney(effect.amount_minor, effect.currency, locale)}</p>
            )}
            {effect.reason && <p>{effect.reason}</p>}
          </li>
        ))}
      </ul>
      <p>{t("affected", { count: result.affected.length })}</p>
      <ul className="space-y-3">
        {result.affected.map((row, i) => {
          const session = sessions.find((item) => item.id === row.session_id);
          return (
            <li key={row.reservation_id} className="rounded-md border p-3 text-sm">
              <label className="flex min-h-11 items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={blocked}
                  checked={accepted.includes(row.reservation_id)}
                  onChange={(event) =>
                    setAccepted((old) =>
                      event.target.checked
                        ? [...old, row.reservation_id]
                        : old.filter((id) => id !== row.reservation_id),
                    )
                  }
                />
                <span>
                  {t("acknowledge", { number: i + 1, count: row.quantity })}
                  {session && (
                    <span className="block">
                      {format.dateTime(new Date(session.starts_at), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      — {format.dateTime(new Date(session.ends_at), { timeStyle: "short" })}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <label className="flex min-h-11 items-center gap-3 text-sm">
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
          type="button"
          className="h-auto min-h-11 whitespace-normal"
          disabled={blocked || !confirmed || accepted.length !== result.affected.length}
          onClick={() => {
            if (!(Date.parse(result.preview.expires_at) > Date.now())) setExpired(true);
            else onApply();
          }}
        >
          {t("apply")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 whitespace-normal"
          disabled={disabled}
          onClick={onBack}
        >
          {t("back")}
        </Button>
      </div>
    </section>
  );
}
