"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import type { Preview } from "@ftksaas/api-contracts";
import type { NamedOption } from "./class-form";

export function ScheduleConfiguration({
  preview,
  timeZone,
  people = [],
  disciplines = [],
  onConfigure,
  disabled = false,
}: {
  preview: Preview;
  timeZone: string;
  people?: NamedOption[];
  disciplines?: NamedOption[];
  onConfigure?: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("scheduleConfiguration");
  const format = useFormatter();
  const requirement = preview.configuration_requirement;
  if (
    requirement?.kind !== "instructor_agreement" ||
    preview.blockers[requirement.blocker_index]?.code !== "POLICY_NOT_CONFIGURED"
  )
    return null;

  const fields = [
    [
      t("person"),
      people.find((person) => person.id === requirement.person_id)?.name ?? requirement.person_id,
    ],
    [
      t("discipline"),
      disciplines.find((discipline) => discipline.id === requirement.discipline_id)?.name ??
        requirement.discipline_id,
    ],
    [t("format"), t(requirement.format)],
    [
      t("occurrence"),
      format.dateTime(new Date(requirement.starts_at), {
        timeZone,
        dateStyle: "long",
        timeStyle: "short",
        hourCycle: "h23",
      }),
    ],
    [t("timeZone"), timeZone],
  ];
  return (
    <section
      aria-label={t("title")}
      className="min-w-0 space-y-3 rounded-md border p-4 text-sm wrap-anywhere"
    >
      <p className="font-semibold">{t("title")}</p>
      <p>{t("explanation")}</p>
      <dl className="space-y-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>{t("nextStep")}</p>
      {onConfigure && (
        <Button type="button" variant="outline" disabled={disabled} onClick={onConfigure}>
          {t("configure")}
        </Button>
      )}
      <p className="text-muted-foreground">{t("limited")}</p>
    </section>
  );
}
