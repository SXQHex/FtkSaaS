"use client";
import { useEffect, useRef, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { validate } from "uuid";
import type { Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { effectMoney } from "../../lib/effect-money";
import type { SetupInput } from "../../lib/studio-setup";
import { FlowError } from "../bookings/flow-controls";
export function CorrectionReview({
  timeZone,
  preview,
  request,
  disabled,
  onApply,
  onBack,
}: {
  timeZone: string;
  preview: Preview;
  request: SetupInput<"collection_correct_preview_v1">;
  disabled: boolean;
  onApply: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("finance"),
    flow = useTranslations("flows"),
    action = useTranslations("program.action"),
    locale = useLocale(),
    format = useFormatter();
  const [confirmed, setConfirmed] = useState(false),
    [expired, setExpired] = useState(() => !(Date.parse(preview.expires_at) > Date.now()));
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, Math.min(2147483647, Date.parse(preview.expires_at) - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [preview.expires_at]);
  const invalid =
    preview.effects.some(
      (effect) =>
        effect.amount_minor != null &&
        (!effect.currency ||
          !/^[A-Z]{3}$/.test(effect.currency) ||
          !/^-?(0|[1-9][0-9]*)$/.test(effect.amount_minor)),
    ) ||
    !Number.isFinite(Date.parse(preview.expires_at)) ||
    !validate(preview.id) ||
    !preview.token.trim();
  const blocked = disabled || expired || invalid || preview.blockers.length > 0;
  return (
    <section
      className="min-w-0 space-y-4 rounded-lg border p-4 wrap-anywhere"
      aria-label={flow("review")}
    >
      <h5 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {flow("review")}
      </h5>
      <p>
        {t(request.correction.direction)} ·{" "}
        {effectMoney(request.correction.amount_minor, request.correction.currency, locale)}
      </p>
      <p>{request.reason}</p>
      <p>
        {t("correctionTime")}:{" "}
        {format.dateTime(new Date(request.correction.occurred_at), {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone,
        })}
      </p>
      {Number.isFinite(Date.parse(preview.expires_at)) && (
        <p>
          {flow("expires", {
            date: format.dateTime(new Date(preview.expires_at), {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone,
            }),
          })}
        </p>
      )}
      {expired && <FlowError code="PREVIEW_STALE" />}
      {invalid && <p role="alert">{t("invalidCorrectionPreview")}</p>}
      {preview.blockers.map((item, index) => (
        <FlowError key={index} code={item.code} />
      ))}
      <ul className="space-y-2 text-sm" aria-label={t("correctionEffects")}>
        {preview.effects.map((effect, index) => (
          <li key={index} className="space-y-2 rounded-md border p-3">
            <p>
              {action(effect.action)} ·{" "}
              {t.has(`effectEntities.${effect.entity.type}`)
                ? t(`effectEntities.${effect.entity.type}`)
                : t("effectRecord", { number: index + 1 })}
            </p>
            {!invalid && effect.amount_minor != null && effect.currency && (
              <p>{effectMoney(effect.amount_minor, effect.currency, locale)}</p>
            )}
            {effect.quantity != null && <p>{effect.quantity}</p>}
            {effect.reason && <p>{effect.reason}</p>}
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
        {flow("confirm")}
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={blocked || !confirmed}
          onClick={() => {
            if (!(Date.parse(preview.expires_at) > Date.now())) setExpired(true);
            else onApply();
          }}
        >
          {flow("apply")}
        </Button>
        <Button variant="outline" disabled={disabled} onClick={onBack}>
          {flow("back")}
        </Button>
      </div>
    </section>
  );
}
