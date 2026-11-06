"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { validate } from "uuid";
import type { Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { effectMoney } from "../../lib/effect-money";
import { AttendanceError } from "./attendance-error";
export function AttendanceReview({
  preview,
  timeZone,
  disabled,
  children,
  onApply,
  onBack,
}: {
  preview: Preview;
  timeZone: string;
  disabled: boolean;
  children: ReactNode;
  onApply: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("attendance"),
    flow = useTranslations("flows"),
    action = useTranslations("program.action"),
    format = useFormatter(),
    locale = useLocale(),
    heading = useRef<HTMLHeadingElement>(null);
  const [confirmed, setConfirmed] = useState(false),
    [expired, setExpired] = useState(() => !(Date.parse(preview.expires_at) > Date.now()));
  useEffect(() => {
    heading.current?.focus();
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, Math.min(2147483647, Date.parse(preview.expires_at) - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [preview.expires_at]);
  const invalid =
    !validate(preview.id) ||
    !preview.token.trim() ||
    !Number.isFinite(Date.parse(preview.expires_at)) ||
    preview.effects.some(
      (x) =>
        x.amount_minor != null &&
        (!x.currency ||
          !/^[A-Z]{3}$/.test(x.currency) ||
          !/^-?(0|[1-9][0-9]*)$/.test(x.amount_minor)),
    );
  const blocked = disabled || expired || invalid || preview.blockers.length > 0;
  return (
    <section aria-label={flow("review")} className="space-y-4 rounded-md border p-4 wrap-anywhere">
      <h5 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {flow("review")}
      </h5>
      {children}
      {Number.isFinite(Date.parse(preview.expires_at)) && (
        <p>
          {flow("expires", {
            date: format.dateTime(new Date(preview.expires_at), {
              timeZone,
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      )}
      {invalid && <p role="alert">{t("invalidAttendance")}</p>}
      {expired && <AttendanceError code="PREVIEW_STALE" />}
      {preview.blockers.map((b, i) => (
        <AttendanceError key={i} code={b.code} />
      ))}
      <ul className="space-y-2" aria-label={t("effects")}>
        {preview.effects.map((effect, i) => (
          <li key={i} className="space-y-2 rounded-md border p-3">
            <p>
              {action(effect.action)} · {t("effect", { number: i + 1 })}
            </p>
            {effect.quantity != null && <p>{t("quantity", { count: effect.quantity })}</p>}
            {!invalid && effect.amount_minor != null && effect.currency && (
              <p>{effectMoney(effect.amount_minor, effect.currency, locale)}</p>
            )}
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
            if (Date.parse(preview.expires_at) > Date.now()) onApply();
            else setExpired(true);
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
