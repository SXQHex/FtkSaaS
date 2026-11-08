"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Preview } from "@ftksaas/api-contracts";
import { errorKey } from "../setup/setup-command";
import { Button } from "@ftksaas/ui/components/button";
import { ScheduleConfiguration } from "./schedule-configuration";
import type { ProgramCatalog } from "./program-form";
export function ProgramReview({
  preview,
  timeZone,
  catalog,
  disabled,
  onApply,
  onBack,
  onConfigure,
}: {
  preview: Preview;
  timeZone: string;
  catalog?: ProgramCatalog;
  disabled: boolean;
  onApply: () => void;
  onBack: () => void;
  onConfigure?: () => void;
}) {
  const t = useTranslations("program");
  const errors = useTranslations("setup");
  const format = useFormatter();
  const [confirmed, setConfirmed] = useState(false);
  const [expired, setExpired] = useState(() => Date.parse(preview.expires_at) <= Date.now());
  useEffect(() => {
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, Math.min(2147483647, Date.parse(preview.expires_at) - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [preview.expires_at]);
  return (
    <section className="min-w-0 space-y-4" aria-label={t("review")}>
      <h3 className="font-semibold">{t("review")}</h3>
      <p>{t("sessionCount", { count: preview.sessions?.length ?? 0 })}</p>
      <p className="text-xs text-muted-foreground">
        {t("expires", {
          date: format.dateTime(new Date(preview.expires_at), {
            timeZone,
            dateStyle: "short",
            timeStyle: "short",
          }),
        })}
      </p>
      {expired && <p role="alert">{t("expired")}</p>}
      {preview.blockers.map((blocker, index) => (
        <p key={index} role="alert" className="rounded-md border border-destructive p-3 text-sm">
          {errors(errorKey(blocker.code))}
        </p>
      ))}
      <ScheduleConfiguration
        onConfigure={onConfigure}
        disabled={disabled}
        preview={preview}
        timeZone={timeZone}
        people={catalog?.duties ?? catalog?.instructors}
        disciplines={catalog?.disciplines}
      />
      <ul className="max-h-72 space-y-2 overflow-y-auto text-sm" aria-label={t("sessions")}>
        {preview.sessions?.map((session) => (
          <li key={session.session_id} className="rounded-md border p-3">
            {format.dateTime(new Date(session.interval.starts_at), {
              timeZone,
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            —{" "}
            {format.dateTime(new Date(session.interval.ends_at), { timeZone, timeStyle: "short" })}{" "}
            · {t("places", { count: session.capacity.total })}
            <ul className="mt-2 space-y-1" aria-label={t("previewResources")}>
              {session.resources.map((resource) => (
                <li key={`${resource.kind}:${resource.id}`}>
                  {t(resource.kind === "room" ? "room" : "assignedPerson")}:{" "}
                  {catalog?.[resource.kind === "room" ? "rooms" : "duties"]?.find(
                    (row) => row.id === resource.id,
                  )?.name ?? resource.id}
                </li>
              ))}
              {session.assignments.map((assignment) => (
                <li key={`${assignment.person_id}:${assignment.duty}`}>
                  {t(assignment.duty)}:{" "}
                  {catalog?.duties?.find(
                    (row) => row.id === assignment.person_id && row.duty === assignment.duty,
                  )?.name ??
                    catalog?.instructors.find((row) => row.id === assignment.person_id)?.name ??
                    assignment.person_id}
                </li>
              ))}
            </ul>
            {session.capacity.categories && (
              <p className="mt-1 text-muted-foreground">
                {t("male")}: {session.capacity.categories.male} · {t("female")}:{" "}
                {session.capacity.categories.female}
              </p>
            )}
          </li>
        ))}
      </ul>
      {preview.effects.length > 0 && (
        <ul className="space-y-2 text-sm" aria-label={t("effects")}>
          {preview.effects.map((effect, index) => (
            <li key={index} className="break-words">
              {t.has(`action.${effect.action}`) ? t(`action.${effect.action}`) : effect.action} ·{" "}
              {t.has(`entity.${effect.entity.type}`)
                ? t(`entity.${effect.entity.type}`)
                : t("record")}
              {effect.quantity != null ? ` · ${effect.quantity}` : ""}
              {effect.amount_minor != null
                ? ` · ${effect.amount_minor} ${effect.currency ?? ""}`
                : ""}
              {effect.reason ? ` · ${effect.reason}` : ""}
            </li>
          ))}
        </ul>
      )}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled || expired || preview.blockers.length > 0}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {t("confirmEffects")}
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="h-auto min-h-11 max-w-full whitespace-normal"
          disabled={disabled || !confirmed || expired || preview.blockers.length > 0}
          onClick={() => {
            if (Date.parse(preview.expires_at) <= Date.now()) setExpired(true);
            else onApply();
          }}
        >
          {t("apply")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={onBack}
          className="h-auto min-h-11 max-w-full whitespace-normal"
        >
          {t("back")}
        </Button>
      </div>
    </section>
  );
}
