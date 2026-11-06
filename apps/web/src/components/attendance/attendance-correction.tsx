"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { correctionRequest, correctionMatches } from "../../lib/attendance";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { FlowError, flowError } from "../bookings/flow-controls";
import { AttendancePermission } from "./attendance-permission";
import type { AttendanceRowProps } from "./attendance-row";
import { AttendanceReview } from "./attendance-review";
export function AttendanceCorrection({
  scope,
  view,
  row,
  number,
  timeZone,
  api,
  onSaved,
}: AttendanceRowProps) {
  const t = useTranslations("attendance"),
    id = useId();
  const command = useSetupCommand(
    scope,
    `attendance:${view.session_id}`,
    () => onSaved(true),
    (code) => onSaved(false, code),
  );
  const [request, setRequest] = useState<ReturnType<typeof correctionRequest> | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState("");
  const disabled = command.busy || !!command.pending,
    loading = !!request && !preview && !error;
  const reset = () => {
    setRequest(null);
    setPreview(null);
    setError("");
  };
  useEffect(() => {
    if (!request) return;
    const life = new AbortController();
    void api
      .preview(scope, request)
      .then((value) => {
        if (!correctionMatches(value, view.session_id)) throw Error("invalidAttendance");
        if (!life.signal.aborted) setPreview(value);
      })
      .catch((cause) => {
        if (!life.signal.aborted) setError(flowError(cause));
      });
    return () => life.abort();
  }, [api, scope, request, view.session_id]);
  return (
    <div className="space-y-3">
      <SetupFeedback command={command} />
      <AttendancePermission
        scope={scope}
        api={api}
        operation="attendance_correct_preview_v1"
        target={view.session_id}
      >
        <form
          className="space-y-3"
          onChange={reset}
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled || loading) return;
            const data = new FormData(event.currentTarget);
            reset();
            try {
              setRequest(
                correctionRequest(
                  view,
                  row,
                  String(data.get("result")),
                  String(data.get("blockReason")),
                  String(data.get("reason")),
                ),
              );
            } catch {
              setError("invalidAttendance");
            }
          }}
        >
          <fieldset disabled={disabled} className="space-y-3">
            <Label htmlFor={`${id}-result`}>{t("result")}</Label>
            <select
              id={`${id}-result`}
              name="result"
              required
              defaultValue=""
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              <option value="">{t("choose")}</option>
              {["attended", "no_show", "blocked"].map((result) => (
                <option key={result} value={result}>
                  {t(`results.${result}`)}
                </option>
              ))}
            </select>
            <Label htmlFor={`${id}-block`}>{t("blockReason")}</Label>
            <select
              id={`${id}-block`}
              name="blockReason"
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
            <Label htmlFor={`${id}-reason`}>{t("reason")}</Label>
            <Input id={`${id}-reason`} name="reason" required maxLength={10000} />
            <Button disabled={loading}>{t("previewCorrection")}</Button>
          </fieldset>
        </form>
      </AttendancePermission>
      {loading && <output aria-live="polite">{t("loading")}</output>}
      {error &&
        (error === "invalidAttendance" ? (
          <p role="alert">{t("invalidAttendance")}</p>
        ) : (
          <FlowError code={error} />
        ))}{" "}
      {preview && request && (
        <AttendanceReview
          key={preview.id}
          preview={preview}
          timeZone={timeZone}
          disabled={disabled}
          onBack={reset}
          onApply={() => {
            const proof = { id: preview.id, token: preview.token };
            reset();
            void command.run({
              operation: "attendance_correct_apply_v1",
              input: {
                org_id: scope.orgId,
                center_id: scope.centerId,
                operation_key: v7(),
                preview: proof,
              },
            });
          }}
        >
          <p>
            {row.subscriber_number
              ? t("subscriber", { number: row.subscriber_number })
              : t("participant", { number })}
            : {t(`results.${row.result}`)} → {t(`results.${request.corrections[0]!.result}`)}
          </p>
          <p>{request.reason}</p>
        </AttendanceReview>
      )}
    </div>
  );
}
