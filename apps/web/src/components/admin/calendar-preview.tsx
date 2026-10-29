"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { SessionCalendar } from "../calendar/session-calendar";
import { SessionDetail } from "../calendar/session-detail";
import { previewSessions } from "./preview-data";
import {
  addDays,
  calendarInterval,
  weekStart,
  type CalendarEntry,
  type CalendarRange,
} from "../../lib/schedule";

// The public design route shares presentation only. No Auth/API fallback lives here.
export function CalendarPreview() {
  const t = useTranslations("admin");
  const change = useTranslations("sessionChange");
  const [date, setDate] = useState("2026-10-29");
  const [range, setRange] = useState<CalendarRange>("day");
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const entries: CalendarEntry[] = Array.from({ length: 6 }, (_, day) =>
    (day % 2 === 0 ? previewSessions.slice(2) : previewSessions).map((session) => ({
      id: `${day}:${session.id}`,
      kind: "session" as const,
      title: t(`sessions.${session.title}`),
      startsAt: `${addDays("2026-10-26", day)}T${session.time}:00+03:00`,
      endsAt: `${addDays("2026-10-26", day)}T${session.end}:00+03:00`,
      capacity: {
        total: session.capacity,
        held: session.count,
        remaining: session.capacity - session.count,
      },
    })),
  ).flat();
  const interval = calendarInterval(
    range === "week" ? weekStart(date) : date,
    range,
    "Europe/Istanbul",
  );
  return (
    <>
      <Link
        href="/tasarim/seans"
        className="mb-4 inline-block text-sm underline underline-offset-4"
      >
        {change("demoTitle")}
      </Link>
      <SessionCalendar
        date={date}
        range={range}
        timeZone="Europe/Istanbul"
        today="2026-10-29"
        entries={entries.filter(
          (entry) =>
            Date.parse(entry.startsAt) < Date.parse(interval.ends_at) &&
            Date.parse(entry.endsAt) > Date.parse(interval.starts_at),
        )}
        onDateChange={setDate}
        onRangeChange={setRange}
        onSelect={setSelected}
      />
      {selected && (
        <SessionDetail
          entry={selected}
          timeZone="Europe/Istanbul"
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
