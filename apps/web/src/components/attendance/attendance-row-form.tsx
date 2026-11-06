"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import type { SetupCommand } from "../../lib/studio-setup";
import { attendanceMark } from "../../lib/attendance-command";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { ConfirmWrite, FlowError } from "../bookings/flow-controls";
import { AttendancePermission } from "./attendance-permission";
import type { AttendanceRowProps } from "./attendance-row";
import { AttendanceCorrection } from "./attendance-correction";
export function AttendanceRowForm(props: AttendanceRowProps) {
  return props.view.closure_state === "closed" ? (
    <AttendanceCorrection {...props} />
  ) : (
    <AttendanceDraft {...props} />
  );
}
function AttendanceDraft({ scope, view, row, number, api, onSaved }: AttendanceRowProps) {
  const t = useTranslations("attendance"),
    flow = useTranslations("flows"),
    id = useId();
  const command = useSetupCommand(
    scope,
    `attendance-row:${row.reservation_id}`,
    () => onSaved(),
    (code) => onSaved(false, code),
  );
  const [draft, setDraft] = useState<SetupCommand | null>(null),
    [error, setError] = useState("");
  const disabled = command.busy || !!command.pending;
  const reset = () => {
    setDraft(null);
    setError("");
  };
  return (
    <div className="space-y-3">
      <SetupFeedback command={command} />
      <>
        {row.result !== "blocked" && (
          <AttendancePermission
            scope={scope}
            api={api}
            operation="attendance_mark_v1"
            target={row.reservation_id}
          >
            <form
              className="space-y-3"
              onChange={reset}
              onSubmit={(event) => {
                event.preventDefault();
                if (disabled) return;
                try {
                  const value = String(new FormData(event.currentTarget).get("result"));
                  if (value !== "attended" && value !== "no_show") throw Error("invalidAttendance");
                  setDraft(attendanceMark(scope, view, row, value));
                } catch {
                  setError("invalidAttendance");
                }
              }}
            >
              <fieldset disabled={disabled} className="space-y-3">
                <Label htmlFor={`${id}-mark`}>{t("result")}</Label>
                <select
                  id={`${id}-mark`}
                  name="result"
                  required
                  defaultValue=""
                  className="min-h-11 w-full rounded-md border bg-background px-3"
                >
                  <option value="">{t("choose")}</option>
                  <option value="attended">{t("results.attended")}</option>
                  <option value="no_show">{t("results.no_show")}</option>
                </select>
                <Button>{flow("review")}</Button>
              </fieldset>
            </form>
          </AttendancePermission>
        )}
        <AttendancePermission
          scope={scope}
          api={api}
          operation="attendance_block_v1"
          target={row.reservation_id}
        >
          <form
            className="space-y-3"
            onChange={reset}
            onSubmit={(event) => {
              event.preventDefault();
              if (disabled) return;
              const reason = String(new FormData(event.currentTarget).get("reason"));
              if (reason !== "debt_policy" && reason !== "credit_limit_exceeded") {
                setError("invalidAttendance");
                return;
              }
              setDraft({
                operation: "attendance_block_v1",
                input: {
                  org_id: scope.orgId,
                  center_id: scope.centerId,
                  operation_key: v7(),
                  reservation_id: row.reservation_id,
                  expected_version: row.version,
                  reason,
                },
              });
            }}
          >
            <fieldset disabled={disabled} className="space-y-3">
              <Label htmlFor={`${id}-block`}>{t("blockReason")}</Label>
              <select
                id={`${id}-block`}
                name="reason"
                required
                defaultValue=""
                className="min-h-11 w-full rounded-md border bg-background px-3"
              >
                <option value="">{t("choose")}</option>
                {["debt_policy", "credit_limit_exceeded"].map((reason) => (
                  <option key={reason} value={reason}>
                    {t(`reasons.${reason}`)}
                  </option>
                ))}
              </select>
              <Button>{t("reviewBlock")}</Button>
            </fieldset>
          </form>
        </AttendancePermission>
      </>
      {error &&
        (error === "invalidAttendance" ? (
          <p role="alert">{t("invalidAttendance")}</p>
        ) : (
          <FlowError code={error} />
        ))}{" "}
      {draft && (
        <ConfirmWrite
          key={draft.input.operation_key}
          command={draft}
          controller={command}
          onBack={reset}
        >
          <p>
            {row.subscriber_number
              ? t("subscriber", { number: row.subscriber_number })
              : t("participant", { number })}
            :{" "}
            {t(
              `results.${draft.operation === "attendance_mark_v1" ? draft.input.result : "blocked"}`,
            )}
          </p>
          {draft.operation === "attendance_block_v1" && <p>{t(`reasons.${draft.input.reason}`)}</p>}
          <p>{t("draftHint")}</p>
        </ConfirmWrite>
      )}
    </div>
  );
}
