"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useCallback, useState, useId } from "react";
import { useTranslations } from "next-intl";
import type { SessionView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { setupCall, type SetupScope } from "../../lib/studio-setup";
import { useRemote } from "../../lib/use-remote";
import { calendarInterval, dateInZone } from "../../lib/schedule";
import { FlowError, flowError } from "../bookings/flow-controls";
import { button } from "./fields";
export function SessionPicker({
  scope,
  timeZone,
  onSelect,
}: {
  scope: SetupScope;
  timeZone: string;
  onSelect: (s: SessionView) => void;
}) {
  const t = useTranslations("crm"),
    f = useFormatter(),
    id = useId(),
    [date, setDate] = useState(() => dateInZone(new Date(), timeZone)),
    [cursor, setCursor] = useState<string>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      setupCall("calendar_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        interval: calendarInterval(date, "day", timeZone),
        page: { limit: 25, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
      }),
    [scope, date, timeZone, cursor],
  );
  const result = useRemote(load, JSON.stringify([scope, date, cursor]));
  return (
    <section aria-label={t("session")} className="space-y-3">
      <Label htmlFor={id}>
        {t("sessionDate")} · {timeZone}
      </Label>
      <Input
        id={id}
        type="date"
        value={date}
        onChange={(e) => {
          if (e.target.value) {
            setDate(e.target.value);
            setCursor(undefined);
          }
        }}
      />
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />} {error && <FlowError code={error} />}{" "}
      {result?.data && (
        <>
          <ul className="space-y-2">
            {result.data.items
              .filter((s) => s.type === "session" && s.center_id === scope.centerId)
              .map((s) => (
                <li key={s.id}>
                  <Button
                    className={button}
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const row = await setupCall("session_get_v1", {
                          org_id: scope.orgId,
                          center_id: scope.centerId,
                          session_id: s.id,
                        });
                        if (row.id !== s.id) throw Error("invalidCrm");
                        onSelect(row);
                        setError("");
                      } catch (e) {
                        setError(flowError(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {s.title} ·{" "}
                    {f.dateTime(new Date(s.starts_at), {
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
              onClick={() => setCursor(result.data!.next_cursor!)}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
