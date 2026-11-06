"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { AttendanceResult } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import type { SetupScope } from "../../lib/studio-setup";
import type { AttendanceApi } from "../../lib/attendance";
import { AttendanceRow } from "./attendance-row";
import { AttendanceSessionActions } from "./attendance-session-actions";
type Props = {
  scope: SetupScope;
  data: Awaited<ReturnType<AttendanceApi["read"]>>;
  timeZone: string;
  api: AttendanceApi;
  failedReservation?: string;
  onSaved: (rights?: boolean, error?: string, reservationId?: string) => void;
};
export function AttendanceRoster({
  scope,
  data,
  timeZone,
  api,
  failedReservation,
  onSaved,
}: Props) {
  const t = useTranslations("attendance"),
    id = useId(),
    headings = useRef(new Map<string, HTMLHeadingElement>());
  const [filter, setFilter] = useState<AttendanceResult | "all">("all"),
    [query, setQuery] = useState(""),
    [focus, setFocus] = useState<{ id: string; attempt: number } | null>(null);
  const entries = data.view.entries,
    counts = { unmarked: 0, attended: 0, no_show: 0, blocked: 0 };
  for (const row of entries) counts[row.result]++;
  const failedIndex = entries.findIndex((row) => row.reservation_id === failedReservation),
    failed = entries[failedIndex];
  const visible = entries
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        (filter === "all" || row.result === filter) &&
        (!query.trim() || row.subscriber_number?.includes(query.trim())),
    );
  function goTo(reservationId: string, unmarked = false) {
    setQuery("");
    setFilter(unmarked ? "unmarked" : "all");
    setFocus((previous) => ({ id: reservationId, attempt: (previous?.attempt ?? 0) + 1 }));
  }
  useEffect(() => {
    if (focus) headings.current.get(focus.id)?.focus();
  }, [focus, filter, query]);
  return (
    <div className="space-y-5">
      {data.session.state === "cancelled" ? (
        <output>{t("cancelled")}</output>
      ) : (
        <AttendanceSessionActions
          scope={scope}
          data={data}
          timeZone={timeZone}
          api={api}
          onSaved={onSaved}
          onUnmarked={() => {
            const row = entries.find((row) => row.result === "unmarked");
            if (row) goTo(row.reservation_id, true);
          }}
        />
      )}
      {failed && (
        <div className="space-y-2 rounded-md border p-3">
          <p>
            {t("failedParticipant", {
              label: failed.subscriber_number
                ? t("subscriber", { number: failed.subscriber_number })
                : t("participant", { number: failedIndex + 1 }),
            })}
          </p>
          <Button variant="outline" onClick={() => goTo(failed.reservation_id)}>
            {t("returnToParticipant")}
          </Button>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(counts) as AttendanceResult[]).map((result) => (
          <div key={result} className="rounded-md border p-3">
            <dt className="text-sm text-muted-foreground">{t(`results.${result}`)}</dt>
            <dd className="text-lg font-semibold tabular-nums">{counts[result]}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${id}-filter`}>{t("filterResult")}</Label>
          <select
            id={`${id}-filter`}
            value={filter}
            className="min-h-11 rounded-md border bg-background px-3"
            onChange={(event) => setFilter(event.target.value as AttendanceResult | "all")}
          >
            <option value="all">{t("allParticipants")}</option>
            {(Object.keys(counts) as AttendanceResult[]).map((result) => (
              <option key={result} value={result}>
                {t(`results.${result}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-search`}>{t("findSubscriber")}</Label>
          <Input
            id={`${id}-search`}
            type="search"
            inputMode="numeric"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      {!entries.length ? (
        <p>{t("empty")}</p>
      ) : !visible.length ? (
        <p>{t("noMatchingParticipants")}</p>
      ) : null}
      <ul className="space-y-3" aria-label={t("participants")}>
        {visible.map(({ row, index }) => (
          <AttendanceRow
            key={row.reservation_id}
            scope={scope}
            view={data.view}
            row={row}
            number={index + 1}
            timeZone={timeZone}
            api={api}
            onSaved={onSaved}
            editable={
              data.session.state !== "cancelled" &&
              (data.session.state === "planned" || data.view.closure_state === "closed")
            }
            headingRef={(node) => {
              if (node) headings.current.set(row.reservation_id, node);
              else headings.current.delete(row.reservation_id);
            }}
          />
        ))}
      </ul>
    </div>
  );
}
