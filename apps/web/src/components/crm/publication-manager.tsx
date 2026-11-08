"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useCallback, useState, useId } from "react";
import { useTranslations } from "next-intl";
import type { CalendarItem } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { setupCall, type SetupScope } from "../../lib/studio-setup";
import { calendarInterval, dateInZone } from "../../lib/schedule";
import { useRemote } from "../../lib/use-remote";
import { FlowError } from "../bookings/flow-controls";
import { Publication } from "./publication";
import { button } from "./fields";
export function PublicationManager({ scope, timeZone }: { scope: SetupScope; timeZone: string }) {
  const t = useTranslations("crm"),
    f = useFormatter(),
    id = useId(),
    [date, setDate] = useState(() => dateInZone(new Date(), timeZone)),
    [cursor, setCursor] = useState<string>(),
    [selected, setSelected] = useState<CalendarItem>(),
    [revision, setRevision] = useState(0);
  const load = useCallback(
    () =>
      setupCall("calendar_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        interval: calendarInterval(date, "week", timeZone),
        page: { limit: 25, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
      }),
    [scope, date, timeZone, cursor],
  );
  const result = useRemote(load, JSON.stringify([scope, date, cursor, revision]));
  return (
    <section className="space-y-4" aria-label={t("publications")}>
      <h3 className="font-semibold">{t("publications")}</h3>
      <Label htmlFor={id}>
        {t("sessionDate")} · {timeZone}
      </Label>
      <Input
        type="date"
        id={id}
        value={date}
        onChange={(e) => {
          if (e.target.value) {
            setDate(e.target.value);
            setCursor(undefined);
            setSelected(undefined);
          }
        }}
      />
      <Button
        className={button}
        variant="outline"
        onClick={() => {
          setSelected(undefined);
          setCursor(undefined);
          setRevision((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}{" "}
      {result?.data && (
        <>
          <ul className="space-y-3">
            {result.data.items.map((row) => (
              <li key={`${row.type}:${row.id}`}>
                <Button className={button} variant="outline" onClick={() => setSelected(row)}>
                  {t(row.type)} · {row.title} ·{" "}
                  {f.dateTime(new Date(row.starts_at), {
                    timeZone,
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Button>
              </li>
            ))}
          </ul>
          {!result.data.items.length && <p>{t("empty")}</p>}
          {result.data.next_cursor && (
            <Button
              className={button}
              variant="outline"
              onClick={() => {
                setCursor(result.data!.next_cursor!);
                setSelected(undefined);
              }}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
      {selected && (
        <div>
          <h4 className="font-semibold">{selected.title}</h4>
          <Publication
            key={`${selected.type}:${selected.id}`}
            scope={scope}
            {...(selected.type === "session"
              ? { sessionId: selected.id }
              : { eventId: selected.id })}
            onSaved={() => setRevision((n) => n + 1)}
          />
        </div>
      )}
    </section>
  );
}
