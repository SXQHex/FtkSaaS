"use client";
import { useTranslations } from "next-intl";
import type { DutyInput } from "@ftksaas/api-contracts";
import type { DutyOption } from "./class-duty";
export function AdditionalDuties({
  people,
  primaryId,
  value,
  onChange,
}: {
  people: DutyOption[];
  primaryId: string;
  value: DutyInput[];
  onChange: (value: DutyInput[]) => void;
}) {
  const t = useTranslations("program");
  const options = people.filter(
    (p, i) =>
      !(p.id === primaryId && p.duty === "instructor") &&
      people.findIndex((other) => other.id === p.id && other.duty === p.duty) === i,
  );
  if (!options.length) return null;
  return (
    <fieldset className="space-y-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{t("additionalDuties")}</legend>
      <p className="text-sm text-muted-foreground">{t("explicitDutiesHint")}</p>
      {options.map((p) => (
        <label key={`${p.id}:${p.duty}`} className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={value.some((v) => v.person_id === p.id && v.duty === p.duty)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...value, { person_id: p.id, duty: p.duty }]
                  : value.filter((v) => !(v.person_id === p.id && v.duty === p.duty)),
              )
            }
          />
          <span className="break-words">
            {p.name} · {t(p.duty)}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
