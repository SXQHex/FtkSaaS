"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { localTimeChoices } from "../../lib/session-change";
export function LocalTimeField({
  label,
  value,
  choice,
  timeZone,
  onChange,
  onChoice,
}: {
  label: string;
  value: string;
  choice: string;
  timeZone: string;
  onChange: (value: string) => void;
  onChoice: (value: string) => void;
}) {
  const t = useTranslations("program"),
    id = useId();
  const choices = localTimeChoices(value, timeZone);
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="datetime-local"
        step={1}
        required
        value={value}
        className="h-auto min-h-11 min-w-0 max-w-full py-2"
        onChange={(e) => {
          onChange(e.target.value);
          onChoice("");
        }}
      />
      {choices.length > 1 && (
        <label className="block space-y-2 text-sm">
          <span>{t("timeOffset", { label })}</span>
          <select
            className="min-h-11 w-full rounded-md border bg-background px-3"
            required
            value={choice}
            onChange={(e) => onChoice(e.target.value)}
          >
            <option value="">{t("choose")}</option>
            {choices.map((c) => (
              <option key={c.instant} value={c.instant}>
                UTC{c.offsetMinutes >= 0 ? "+" : ""}
                {c.offsetMinutes / 60}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
