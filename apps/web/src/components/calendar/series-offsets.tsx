"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { LocalOffsetChoice } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { localTimeChoices } from "../../lib/session-change";
import { seriesOffset } from "../../lib/session-resources";
function offsetLabel(minutes: number) {
  return `UTC${minutes < 0 ? "−" : "+"}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0")}:${String(Math.abs(minutes) % 60).padStart(2, "0")}`;
}
export function SeriesOffsets({
  start,
  timeZone,
  value,
  onChange,
}: {
  start: string;
  timeZone: string;
  value: LocalOffsetChoice[];
  onChange: (value: LocalOffsetChoice[]) => void;
}) {
  const t = useTranslations("sessionChange");
  const [date, setDate] = useState("");
  const choices = localTimeChoices(`${date}T${start.slice(11)}`, timeZone);
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label={t("seriesOffsets")}>
      <h3 className="font-medium">{t("seriesOffsets")}</h3>
      <p className="text-sm text-muted-foreground">
        {t("seriesOffsetsHint", { timezone: timeZone })}
      </p>
      <label className="block space-y-2 text-sm">
        <span>{t("offsetDate")}</span>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {date && choices.length < 2 && (
        <output aria-live="polite" className="block text-sm">
          {t("notAmbiguous")}
        </output>
      )}
      {choices.length > 1 && (
        <div className="flex flex-wrap gap-3">
          {choices.map((c) => (
            <Button
              type="button"
              variant="outline"
              key={c.instant}
              onClick={() => {
                const choice = seriesOffset(date, start, timeZone, c.offsetMinutes);
                onChange(
                  [...value.filter((v) => v.date !== date), choice].sort((a, b) =>
                    a.date.localeCompare(b.date),
                  ),
                );
                setDate("");
              }}
            >
              {t("useOffset", { offset: offsetLabel(c.offsetMinutes) })}
            </Button>
          ))}
        </div>
      )}
      <ul className="space-y-2 text-sm">
        {value.map((v) => (
          <li key={v.date} className="flex flex-wrap items-center gap-3">
            <span>
              {v.date} · {t("offsetMinutes", { offset: offsetLabel(v.offset_minutes) })}
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(value.filter((c) => c.date !== v.date))}
            >
              {t("removeOffset", { date: v.date })}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
