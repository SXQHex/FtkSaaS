"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { Preview } from "@ftksaas/api-contracts";
import type { NamedOption } from "./class-form";

export function ScheduleConfiguration({
  preview,
  timeZone,
  people = [],
  disciplines = [],
}: {
  preview: Preview;
  timeZone: string;
  people?: NamedOption[];
  disciplines?: NamedOption[];
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
      <p className="text-muted-foreground">{t("limited")}</p>
    </section>
  );
}
