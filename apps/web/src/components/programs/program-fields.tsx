"use client";
import { useId, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { programDays, type ProgramInput } from "../../lib/program";
import { localTimeChoices } from "../../lib/session-change";
import type { ProgramCatalog } from "./program-form";
export function ProgramFields({
  draft,
  setDraft,
  offsets,
  setOffsets,
  catalog,
  timeZone,
  disabled,
  loading,
}: {
  draft: ProgramInput;
  setDraft: (value: ProgramInput) => void;
  offsets: Record<string, number>;
  setOffsets: (value: Record<string, number>) => void;
  catalog: ProgramCatalog;
  timeZone: string;
  disabled: boolean;
  loading: boolean;
}) {
  const t = useTranslations("program");
  const id = useId();
  const ambiguous = useMemo(() => {
    try {
      return programDays(draft.starts_on, draft.ends_on, draft.weekdays)
        .map((date) => ({
          date,
          choices: localTimeChoices(`${date}T${draft.local_start}`, timeZone),
        }))
        .filter((item) => item.choices.length > 1);
    } catch {
      // Incomplete input has no DST choices; submit reports the validation error.
      return [];
    }
  }, [draft.starts_on, draft.ends_on, draft.weekdays, draft.local_start, timeZone]);
  function field(
    name: "starts_on" | "ends_on" | "local_start" | "duration_minutes" | "total",
    label: string,
    type: string,
  ) {
    return (
      <div className="min-w-0 space-y-2">
        <Label htmlFor={`${id}-${name}`}>{t(label)}</Label>
        <Input
          id={`${id}-${name}`}
          name={name}
          type={type}
          required
          step={type === "time" ? 1 : type === "number" ? 1 : undefined}
          min={type === "number" ? (name === "total" ? 0 : 1) : undefined}
          value={typeof draft[name] === "number" && Number.isNaN(draft[name]) ? "" : draft[name]}
          onChange={(event) =>
            setDraft({
              ...draft,
              [name]:
                type === "number"
                  ? event.target.value === ""
                    ? NaN
                    : Number(event.target.value)
                  : event.target.value,
            })
          }
        />
      </div>
    );
  }
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-5">
      <legend className="sr-only">{t("newProgram")}</legend>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {field("starts_on", "startDate", "date")}
        {field("ends_on", "endDate", "date")}
        {field("local_start", "startTime", "time")}
        {field("duration_minutes", "duration", "number")}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("weekdays")}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <label key={day} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.weekdays.includes(day)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    weekdays: event.target.checked
                      ? [...draft.weekdays, day].sort()
                      : draft.weekdays.filter((d) => d !== day),
                  })
                }
              />
              {t(`day${day}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["room_id", "room", catalog.rooms],
            ["person_id", "instructor", catalog.instructors],
          ] as const
        ).map(([name, label, options]) => (
          <div key={name} className="space-y-2">
            <Label htmlFor={`${id}-${name}`}>{t(label)}</Label>
            <select
              id={`${id}-${name}`}
              required
              value={draft[name]}
              onChange={(event) => setDraft({ ...draft, [name]: event.target.value })}
              className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">{t("choose")}</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {field("total", "capacity", "number")}
      {ambiguous.map(({ date, choices }) => (
        <div key={date} className="space-y-2">
          <Label htmlFor={`${id}-${date}`}>{t("offset", { date })}</Label>
          <select
            id={`${id}-${date}`}
            required
            value={offsets[date] ?? ""}
            onChange={(event) => setOffsets({ ...offsets, [date]: Number(event.target.value) })}
            className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">{t("choose")}</option>
            {choices.map((choice) => (
              <option key={choice.instant} value={choice.offsetMinutes}>
                UTC{choice.offsetMinutes >= 0 ? "+" : ""}
                {choice.offsetMinutes / 60}
              </option>
            ))}
          </select>
        </div>
      ))}
      <Button type="submit">{t(loading ? "previewing" : "preview")}</Button>
    </fieldset>
  );
}
