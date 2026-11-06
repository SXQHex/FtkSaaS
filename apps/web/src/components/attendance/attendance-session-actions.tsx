"use client";
import { useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import type { SetupCommand, SetupScope } from "../../lib/studio-setup";
import type { AttendanceApi } from "../../lib/attendance";
import { attendanceClose, attendanceStart } from "../../lib/attendance-command";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { ConfirmWrite } from "../bookings/flow-controls";
import { LocalTimeField } from "../programs/local-time-field";
import { AttendancePermission } from "./attendance-permission";
type Props = {
  scope: SetupScope;
  data: Awaited<ReturnType<AttendanceApi["read"]>>;
  timeZone: string;
  api: AttendanceApi;
  onSaved: (rights?: boolean, error?: string) => void;
};
export function AttendanceSessionActions(props: Props) {
  const { data } = props;
  if (data.view.closure_state !== "open" || data.session.state !== "planned") return null;
  return (
    <div className="space-y-4">
      {data.view.actual_started_at === null && (
        <AttendancePermission {...props} operation="attendance_start_v1" target={data.session.id}>
          <SessionForm {...props} mode="start" />
        </AttendancePermission>
      )}
      <AttendancePermission {...props} operation="attendance_close_v1" target={data.session.id}>
        <SessionForm {...props} mode="close" />
      </AttendancePermission>
    </div>
  );
}
function SessionForm({
  scope,
  data,
  timeZone,
  onSaved,
  mode,
}: Props & { mode: "start" | "close" }) {
  const t = useTranslations("attendance"),
    flow = useTranslations("flows"),
    format = useFormatter(),
    id = useId();
  const [local, setLocal] = useState(""),
    [offset, setOffset] = useState(""),
    [draft, setDraft] = useState<SetupCommand | null>(null),
    [invalid, setInvalid] = useState(false);
  const command = useSetupCommand(
    scope,
    `attendance:${data.session.id}`,
    () => onSaved(mode === "close"),
    (code) => onSaved(false, code),
  );
  const disabled = command.busy || !!command.pending;
  const roster = [
    ...new Set(
      data.session.assignments.filter((x) => x.duty === "instructor").map((x) => x.person_id),
    ),
  ];
  return (
    <section aria-label={t(mode)} className="min-w-0 space-y-3 rounded-md border p-4">
      <h4 className="font-semibold">{t(mode)}</h4>
      <SetupFeedback command={command} />
      <form
        className="space-y-3"
        onChange={() => {
          setDraft(null);
          setInvalid(false);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled) return;
          const values = new FormData(event.currentTarget);
          try {
            setDraft(
              mode === "start"
                ? attendanceStart(
                    scope,
                    data.view,
                    local,
                    timeZone,
                    offset,
                    String(values.get("reason") ?? ""),
                  )
                : attendanceClose(
                    scope,
                    data.view,
                    data.session,
                    String(values.get("performed") ?? ""),
                    values.getAll("instructors").map(String),
                  ),
            );
            setInvalid(false);
          } catch {
            setDraft(null);
            setInvalid(true);
          }
        }}
      >
        <fieldset disabled={disabled} className="space-y-3">
          {mode === "start" ? (
            <>
              <LocalTimeField
                label={t("actualStart")}
                value={local}
                choice={offset}
                timeZone={timeZone}
                onChange={setLocal}
                onChoice={setOffset}
              />
              <Label htmlFor={id}>{t("reason")}</Label>
              <Input id={id} name="reason" maxLength={10000} required />
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("closeHint")}</p>
              <p>
                {t("countSummary", {
                  marked: data.view.entries.filter((x) => x.result !== "unmarked").length,
                  total: data.view.entries.length,
                })}
              </p>
              <Label htmlFor={id}>{t("performed")}</Label>
              <select
                id={id}
                name="performed"
                required
                defaultValue=""
                className="min-h-11 w-full rounded-md border bg-background px-3"
              >
                <option value="">{t("choose")}</option>
                <option value="yes">{t("yes")}</option>
                <option value="no">{t("no")}</option>
              </select>
              <fieldset className="space-y-2">
                <legend>{t("actualInstructors")}</legend>
                {roster.map((person, index) => (
                  <label className="flex min-h-11 items-center gap-3" key={person}>
                    <input type="checkbox" name="instructors" value={person} />
                    {t("instructor", { number: index + 1 })}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          <Button className="h-auto min-h-11 whitespace-normal">{flow("review")}</Button>
        </fieldset>
      </form>
      {invalid && <p role="alert">{t("invalidAttendance")}</p>}
      {draft && (
        <ConfirmWrite
          key={draft.input.operation_key}
          command={draft}
          controller={command}
          onBack={() => setDraft(null)}
        >
          <p>{t(mode)}</p>
          {draft.operation === "attendance_start_v1" ? (
            <>
              <p>
                {format.dateTime(new Date(draft.input.actual_started_at), {
                  timeZone,
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · {timeZone}
              </p>
              <p>{draft.input.reason}</p>
            </>
          ) : draft.operation === "attendance_close_v1" ? (
            <>
              <p>{t(draft.input.performed ? "yes" : "no")}</p>
              <p>
                {t("instructorCount", { count: draft.input.performed_instructor_ids?.length ?? 0 })}
              </p>
              <ul>
                {draft.input.performed_instructor_ids?.map((person) => (
                  <li key={person}>{t("instructor", { number: roster.indexOf(person) + 1 })}</li>
                ))}
              </ul>
              <ul>
                {data.view.entries.map((row, index) => (
                  <li key={row.reservation_id}>
                    {row.subscriber_number
                      ? t("subscriber", { number: row.subscriber_number })
                      : t("participant", { number: index + 1 })}
                    : {t(`results.${row.result}`)}
                  </li>
                ))}
              </ul>
              <p>{t("closeHint")}</p>
            </>
          ) : null}
        </ConfirmWrite>
      )}
    </section>
  );
}
