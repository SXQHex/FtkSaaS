"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { SetupCommand, SetupScope } from "../../lib/studio-setup";
import type { BookingApi } from "../../lib/bookings";
import { sessionInterval } from "../../lib/session-create";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { Button } from "@ftksaas/ui/components/button";
import type { useSetupCommand } from "../setup/setup-command";
import { LocalTimeField } from "../programs/local-time-field";
import { ConfirmWrite, FlowError, flowError } from "./flow-controls";
export function RequestForm({
  scope,
  personId,
  timeZone,
  api,
  command,
}: {
  scope: SetupScope;
  personId: string;
  timeZone: string;
  api: BookingApi;
  command: ReturnType<typeof useSetupCommand>;
}) {
  const t = useTranslations("flows"),
    id = useId(),
    [catalog, setCatalog] = useState<Awaited<ReturnType<BookingApi["catalog"]>> | null>(null),
    [error, setError] = useState(""),
    [draft, setDraft] = useState<SetupCommand | null>(null),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const disabled = command.busy || !!command.pending;
  useEffect(() => {
    let active = true;
    void api
      .catalog(scope)
      .then((value) => {
        if (active) setCatalog(value);
      })
      .catch((cause) => {
        if (active) setError(flowError(cause));
      });
    return () => {
      active = false;
    };
  }, [api, scope]);
  return (
    <section className="min-w-0 space-y-4" aria-label={t("newRequest")}>
      <h4 className="font-semibold">{t("newRequest")}</h4>
      <p className="text-sm">
        {t("requestHint")} · {timeZone}
      </p>
      {error && <FlowError code={error} />}
      {!catalog && !error && <output>{t("loading")}</output>}
      {catalog && (
        <form
          className="space-y-3"
          onChange={() => setDraft(null)}
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled || !scope.centerId) return;
            try {
              const data = new FormData(event.currentTarget),
                discipline = String(data.get("discipline")),
                instructor = String(data.get("instructor") ?? ""),
                interval = sessionInterval(start, end, timeZone, from, to),
                duration = (Date.parse(interval.ends_at) - Date.parse(interval.starts_at)) / 60000;
              if (
                !Number.isSafeInteger(duration) ||
                duration < 1 ||
                !catalog.disciplines.some((item) => item.id === discipline) ||
                (instructor && !catalog.instructors.some((item) => item.id === instructor))
              )
                throw Error("invalidForm");
              const exception = data.get("exception") === "on",
                reason = String(data.get("reason") ?? "").trim();
              if (exception && !reason) throw Error("invalidForm");
              setDraft({
                operation: "lesson_request_create_v1",
                input: {
                  org_id: scope.orgId,
                  center_id: scope.centerId,
                  operation_key: v7(),
                  person_id: personId,
                  discipline_id: discipline,
                  requested_start: interval.starts_at,
                  duration_minutes: duration,
                  ...(instructor ? { preferred_instructor_id: instructor } : {}),
                  ...(exception ? { window_exception: true, reason } : {}),
                },
              });
              setError("");
            } catch (cause) {
              setError(flowError(cause));
            }
          }}
        >
          <fieldset disabled={disabled} className="min-w-0 space-y-3">
            <Label htmlFor={`${id}-discipline`}>{t("discipline")}</Label>
            <select
              id={`${id}-discipline`}
              name="discipline"
              required
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              <option value="">{t("choose")}</option>
              {catalog.disciplines.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <Label htmlFor={`${id}-instructor`}>{t("instructor")}</Label>
            <select
              id={`${id}-instructor`}
              name="instructor"
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              <option value="">{t("noPreference")}</option>
              {catalog.instructors.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <LocalTimeField
              label={t("start")}
              value={start}
              onChange={setStart}
              choice={from}
              onChoice={setFrom}
              timeZone={timeZone}
            />
            <LocalTimeField
              label={t("end")}
              value={end}
              onChange={setEnd}
              choice={to}
              onChoice={setTo}
              timeZone={timeZone}
            />
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="exception" />
              {t("windowException")}
            </label>
            <Label htmlFor={`${id}-reason`}>{t("reason")}</Label>
            <Input id={`${id}-reason`} name="reason" />
            <Button className="h-auto min-h-11 max-w-full whitespace-normal">
              {t("inspectRequest")}
            </Button>
          </fieldset>
        </form>
      )}
      {draft && (
        <ConfirmWrite
          key={draft.input.operation_key}
          command={draft}
          controller={command}
          onBack={() => setDraft(null)}
        >
          <p>
            {start} — {end} · {timeZone}
          </p>
          <p>{t("requestHint")}</p>
        </ConfirmWrite>
      )}
    </section>
  );
}
